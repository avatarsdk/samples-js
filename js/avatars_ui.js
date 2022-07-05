/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; js-indent-level: 2 -*- */

/* Copyright 2022 Itseez3D, Inc. <support@itseez3d.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the
 *    distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


import * as ASDK from './asdk.js';
import GUI from './lil-gui.esm.min.js';
import InputFileImageController from './lil-gui-InputFileImageController.esm.js';
import * as AvatarsGL from './avatars_gl.js';


// === constants ===============================================================

const _BOOLEAN_CATEGORIES = [
  'haircuts', 'blendshapes', 'model_info', 'additional_textures'
];
const _DICT_CATEGORIES = [
  'shape_modifications', 'avatar_modifications', 'body_shape',
];

const _BOOLEAN_PARAMETERS = [
  'add_eyelid_shadow', 'add_glare', 'allow_modify_neck',
  'curved_bottom', 'enhance_lighting', 'parametric_eyes_texture',
  'parametric_eyes_texture_v2', 'remove_smile', 'remove_stubble',
  'remove_glasses', 'repack_texture', 'slightly_cartoonish_texture'
];
const _FLOAT_PARAMETERS = [
  'caricature_amount', 'cartoonish_v0.3', 'cartoonish_v1.0', 'height',
  'weight', 'chest', 'waist', 'hips'
];
const _INTEGER_PARAMETERS = [
  'generated_haircut_faces_count'
];
const _COLOR_PARAMETERS = [
  'eye_iris_color', 'eye_sclera_color', 'hair_color', 'lips_color', 'teeth_color'
];
const _SIZE_PARAMETERS = [
  'generated_haircut_texture_size', 'texture_size'
];
const _OPTIONS_PARAMETERS = {
  'gender': ['non_binary', 'female', 'male']
};

const _ADDITIONAL_TEXTURES_BODY = [
  'normal_map', 'roughness_map', 'metallic_map',
];
const _ADDITIONAL_TEXTURES_OUTFITS = [
  ..._ADDITIONAL_TEXTURES_BODY, 'body_visibility_mask',
];
const _ADDITIONAL_TEXTURES_HEAD = [
  'roughness_map', 'metallic_map', 'lips_mask',
];

const _FORMATS = [
  'gltf', 'glb', 'fbx', 'obj', 'ply'
];

const _AS_AVATAR = 'as avatar';
const _TRUE = 'true';
const _FALSE = 'false';
const _BOOL_OPTIONS = [_TRUE, _FALSE];
let _inheritOptions = (options) => [_AS_AVATAR, ...options];
const _ALL_NONE_KEY = '_allNone';


// === main ====================================================================

export function init(config) {
  let asdk = new ASDK.AvatarSDK(config['token'], config['app_api']);

  init_ui(asdk, config);
  AvatarsGL.init_gl(config['canvas']);

  config['canvas'].addEventListener('dblclick', (evt) => evt.target.requestFullscreen());
}


function init_ui(asdk, config) {
  let pipelinesContainer = config['pipelines_control'];

  while (pipelinesContainer.childNodes.length > 0) pipelinesContainer.removeChild(pipelinesContainer.childNodes[0]);

  let controls = new GUI({container: pipelinesContainer, title: 'Avatar'});
  let cObj = {
    'photo': '',
    'pipeline': 'select one',
    'parameters': {},
    'export_parameters': {},
  };

  new InputFileImageController(controls, cObj, 'photo');

  let pipelines = config['available_pipelines'];
  let options = pipelines.reduce((a, i) => {
    const [pipeline, subtypes] = i;

    let options = subtypes.reduce((aa, ii) => {
      aa.push(pipeline + ' | ' + ii);
      return aa;
    }, []);

    a.push(...options);

    return a;
  }, []);

  controls.add(cObj, 'pipeline', options).onChange(
    (v) => onPipelineSelected(v, asdk, controls, cObj, config)
  );

  _addFunctionGui(
    cObj, 'computeAvatar',
    () => onComputeAvatar(asdk, cObj, config),
    controls, 'Generate avatar'
  );

  let _onParametersFolderChange = () => fillParametersJson(
    config['parameters_json'],
    () => cObj['parameters'],
    generateComputationParameters
  );
  controls.addFolder(_title('parameters')).hide().onChange(_onParametersFolderChange);

  let _onExportParametersFolderChange = () => fillParametersJson(
    config['export_parameters_json'],
    () => cObj['export_parameters'],
    generateExportParameters
  );
  controls.addFolder(_title('export parameters')).hide().onChange(_onExportParametersFolderChange);

  _showElement(config['pipelines_container']);
}


function onPipelineSelected(value, asdk, controls, cObj, config) {
  const [pipeline, subtype] = _splitPipeline(value);

  startProcessingOverlay(config['pipelines_control'], true);

  let parametersPromise = asdk.get_available_parameters(pipeline, subtype)
  let exportParametersPromise = asdk.get_available_export_parameters(pipeline, subtype)

  Promise.all([parametersPromise, exportParametersPromise]).then((promises) => {
    let [parameters, exportParameters] = promises;

    parameters = _delete_parameters_duplicates(parameters, exportParameters);

    fillParametersGui(parameters, controls, cObj);
    fillParametersJson(
      config['parameters_json'],
      () => cObj['parameters'],
      generateComputationParameters
    );
    _showElement(config['jsons_container']);

    fillExportParametersGui(exportParameters, controls, cObj);
    fillParametersJson(
      config['export_parameters_json'],
      () => cObj['export_parameters'],
      generateExportParameters
    );
    _showElement(config['jsons_container']);
  }).then(
    () => endProcessingOverlay(config['pipelines_control'])
  ).catch((err) => {
    let msg = extractErrorMessage(err, 'Something went wrong');
    startErrorOverlay(config['pipelines_control'], msg);
  });
}


function fillParametersJson(target, getter, generator) {
  let parameters = generator(getter());
  target.innerHTML = JSON.stringify(parameters, null, 2);
}


function fillParametersGui(parameters, controls, cObj) {
  let subtype = Object.keys(parameters);
  if (!subtype.length) return;

  let rootFolder = _emptyFolder(
    _getRootFolder(controls, _title('parameters'))
  );

  let rootObj = {};

  subtype = subtype[0]
  parameters = parameters[subtype];

  let _processGroupParameters = (category, group, gParameters, obj, folder) => {
    for (const parameter of gParameters) {
      let objKey = [category, group, parameter].join('.');

      let isBoolean = _BOOLEAN_CATEGORIES.includes(category) ||
          _BOOLEAN_PARAMETERS.includes(parameter);

      if (isBoolean) {
        _addBooleanParameterGui(obj, objKey, false, folder, parameter);
        continue;
      } else if (_FLOAT_PARAMETERS.includes(parameter)) {
        _addEnableParameterGui(
          obj, objKey, _makeEnableObj(0), folder,
          (folder, eObj, _, name) => folder.add(eObj, 'value', 0).name(name).step(0.01),
          parameter
        );

        continue;
      } else if (_INTEGER_PARAMETERS.includes(parameter)) {
        _addEnableParameterGui(
          obj, objKey, _makeEnableObj(0), folder,
          (folder, eObj, _, name) => folder.add(eObj, 'value', 0).name(name).step(1),
          parameter
        );

        continue;
      } else if (_COLOR_PARAMETERS.includes(parameter)) {
        _addEnableParameterGui(
          obj, objKey, _makeColorObj(), folder,
          (folder, eObj, _, name) => folder.addColor(eObj, 'value', 255).name(name),
          parameter
        );

        continue;
      } else if (_SIZE_PARAMETERS.includes(parameter)) {
        _addEnableParameterGui(obj, objKey, _makeSizeEObj(), folder, _customSizeAdd, parameter);

        continue;
      } else if (parameter in _OPTIONS_PARAMETERS) {
        let options = _OPTIONS_PARAMETERS[parameter];
        let optionsEObj = _makeEnableObj(options[0]);

        _addEnableParameterGui(
          obj, objKey, optionsEObj, folder,
          (folder, eObj, _, name) => folder.add(eObj, 'value', options).name(name),
          parameter
        )

        continue;
      }

      console.log('unknown parameter %s', objKey);
    }
  }

  for (const [category, groups] of Object.entries(parameters)) {
    let folder = rootFolder.addFolder(_title(category)).close();

    if (_BOOLEAN_CATEGORIES.includes(category)) {
      let nOfParameters = 0;

      if (Array.isArray(groups)) {
        nOfParameters = groups.length;
      } else {
        nOfParameters = Object.values(groups).reduce((a, g) => a + g.length, 0);
      }

      if (nOfParameters > 3) {
        let key = [category, _ALL_NONE_KEY].join('.');
        _addAllNoneBtn(rootObj, key, folder)
      }
    }

    if (Array.isArray(groups)) {
      _processGroupParameters(category, '', groups, rootObj, folder);
    } else {
      for (const [group, gParameters] of Object.entries(groups)) {
        _processGroupParameters(category, group, gParameters, rootObj, folder);
      }
    }
  }

  cObj['parameters'] = rootObj;

  rootFolder.show();
  return rootFolder;
}


function generateComputationParameters(parameters) {
  let ret = {};

  let _setDictValue = (isBoolean, obj, parameter, value) => {
    let v = isBoolean ? true : value['value'];

    let isColor = _COLOR_PARAMETERS.includes(parameter);
    obj[parameter] = isColor ? _convertGuiColor(v) : _copy(v);

    return obj;
  }

  for (const [key, value] of Object.entries(parameters)) {
    const [category, group, parameter] = key.split('.');

    if (group == _ALL_NONE_KEY) continue;

    let isBoolean = _BOOLEAN_CATEGORIES.includes(category) ||
        _BOOLEAN_PARAMETERS.includes(parameter);
    let isEnabled = (isBoolean && !!value) || !!value['enabled'];

    if (!isEnabled) continue;

    let isDictCategory = _DICT_CATEGORIES.includes(category);

    let emptyCat = (!!group || isDictCategory) ? {} : [];
    let cat = _getDefault(ret, category, emptyCat);

    let emptyGrp = isDictCategory ? {} : [];
    let target = !!group ? _getDefault(cat, group, emptyGrp) : cat;

    let _dictSetter = (target) => _setDictValue(isBoolean, target, parameter, value);
    let _appender = (target) => target.push(parameter);
    let setter = isDictCategory ? _dictSetter : _appender;

    setter(target);
  }

  return ret;
}


function fillExportParametersGui(parameters, controls, cObj) {
  const [pipeline, subtype] = _splitPipeline(cObj['pipeline']);

  let rootFolder = _emptyFolder(
    _getRootFolder(controls, _title('export parameters'))
  );

  let _makeListObj = (src) => src.reduce(
    (a,i) => {a[i] = false; return a;},
    {}
  )

  let _makeLodObj = () => _makeEnableObj(0);

  let _addOptionsParameterGui = (obj, key, value, options, folder) => {
    obj[key] = value;
    folder.add(obj, key, options);
  }

  let _addListParameterGui = (obj, key, value, folder) => {
    obj[key] = value;

    let entries = Object.entries(value);

    let lFolder = folder.addFolder(_title(key)).close();

    if (entries.length > 3) {
      _addAllNoneBtn(obj, _ALL_NONE_KEY, lFolder);
    }

    entries.forEach(([k,v]) => lFolder.add(value, k));
  }

  let exportParameters = {
    // 'template': '', // TODO: some day
  };

  _addOptionsParameterGui(exportParameters, 'format', 'glb', _FORMATS, rootFolder);
  _addBooleanParameterGui(exportParameters, 'embed', true, rootFolder);
  _addBooleanParameterGui(exportParameters, 'pointclouds', false, rootFolder);
  let aTextures = pipeline === 'body_0.3' ? _ADDITIONAL_TEXTURES_BODY : _ADDITIONAL_TEXTURES_HEAD;
  _addListParameterGui(exportParameters, 'additional_textures', _makeListObj(aTextures), rootFolder);
  _addBooleanParameterGui(exportParameters, 'embed_textures', false, rootFolder);
  _addEnableParameterGui(exportParameters, 'texture_size', _makeSizeEObj(), rootFolder, _customSizeAdd);
  _addEnableParameterGui(exportParameters, 'lod', _makeLodObj(), rootFolder, (folder, obj, key) => {
    folder.add(obj, 'value', 0, 8, 1).name(key);
  })

  for (const [category, values] of Object.entries(parameters)) {
    // workaround for accidentially copied section into export_resources.json
    if (category === 'additional_textures') continue;

    let catObj = {};
    let folder = rootFolder.addFolder(_title(category)).close();

    _addListParameterGui(catObj, 'list', _makeListObj(values), folder);
    _addOptionsParameterGui(catObj, 'format', _AS_AVATAR, _inheritOptions(_FORMATS), folder);
    _addOptionsParameterGui(catObj, 'embed', _AS_AVATAR, _inheritOptions(_BOOL_OPTIONS), folder);
    _addOptionsParameterGui(catObj, 'pointclouds', _AS_AVATAR, _inheritOptions(_BOOL_OPTIONS), folder);

    switch (category) {
    case 'haircuts':
      _addEnableParameterGui(catObj, 'color', _makeColorObj(), folder, (folder, obj, key) => {
        folder.addColor(obj, 'value', 255).name(key)
      })
      _addEnableParameterGui(catObj, 'texture_size', _makeSizeEObj(), folder, _customSizeAdd);
      _addOptionsParameterGui(catObj, 'embed_textures', _AS_AVATAR, _inheritOptions(_BOOL_OPTIONS), folder);
      break;
    case 'outfits':
      _addListParameterGui(catObj, 'additional_textures', _makeListObj(_ADDITIONAL_TEXTURES_OUTFITS), folder);
      _addEnableParameterGui(catObj, 'texture_size', _makeSizeEObj(), folder, _customSizeAdd);
      _addOptionsParameterGui(catObj, 'embed_textures', _AS_AVATAR, _inheritOptions(_BOOL_OPTIONS), folder);
      break;
    case 'blendshapes':
      // nothing to add
      break;
    default:
      console.log('unknown export category "%s"', category);
    }

    exportParameters[category] = catObj;
  }

  cObj['export_parameters'] = exportParameters;

  rootFolder.show();
  return rootFolder;
}


function generateExportParameters(parameters) {
  let _processListParameter = (listParameter) => Object.entries(listParameter).reduce((a,i) => {
    if (i[1] === true) a.push(i[0]);
    return a;
  }, []);

  let _processInheritOptions = (value) => {
    switch (value) {
    case _AS_AVATAR:
      return null;
    case _TRUE:
      return true;
    case _FALSE:
      return false;
    }

    return _copy(value);
  }

  let _processSection = (root) => {
    let ret = {};

    for (const [key, value] of Object.entries(root)) {
      switch (key) {
      case 'format':
      case 'embed':
      case 'pointclouds':
      case 'embed_textures': {
        let v = _processInheritOptions(value);
        if (v === null) continue;
        ret[key] = v;
        break;
      }
      case 'additional_textures':
      case 'list': {
        let v = _processListParameter(value);
        if (v.length === 0) continue;
        ret[key] = v;
        break;
      }
      case 'lod':
      case 'color':
      case 'texture_size': {
        if (!value['enabled']) continue;
        let v = value['value'];
        v = (key === 'color') ? _convertGuiColor(v) : _copy(v);
        ret[key] = v;
        break;
      }
      case 'haircuts':
      case 'outfits':
      case 'blendshapes': {
        let v = _processSection(value);
        if (Object.keys(v).length === 0) continue;
        ret[key] = v;
        break;
      }
      case _ALL_NONE_KEY:
        break;
      default:
        console.log('unknown key "%s"', key);
      }
    }

    return ret;
  }

  let ret = _processSection(parameters);

  return ret;
}


function generateVisualExportParameters(parameters) {
  let ret = {
    'format': 'glb',
    'embed': true,
    'embed_textures': true,
  };

  const _keysToCopy = ['lod', 'texture_size', 'color'];
  const _catToCopy = ['', 'haircuts', 'outfits'];

  for (const category of _catToCopy) {
    let root = parameters;
    let target = ret;

    if (!!category) {
      root = parameters?.[category];
      if (root === undefined) continue;

      target = _getDefault(ret, category, {});

      let catList = root.list;

      let valid = (!!catList) && catList.length > 0;
      if (valid) {
        target['list'] = [catList[0]]
      };
    }

    for (const key of _keysToCopy) {
      let value = root?.[key];
      if (value === undefined) continue;

      target[key] = value;
    }
  }

  return ret;
}


function onComputeAvatar(asdk, cObj, config) {
  let ctrl = config['pipelines_control'];
  let callbacks = startProcessingOverlay(ctrl, true, 'Uploading', '');
  let onProgress = (a) => _onAvatarProgress(callbacks, a);

  _hideElement(config['exports_container']);
  _hideElement(config['canvas_container']);
  AvatarsGL.reset();

  let photo = cObj['photo'][0];
  if (!photo) return startErrorOverlay(ctrl, 'Please select a photo');

  const [pipeline, subtype] = _splitPipeline(cObj['pipeline']);
  let availablePipelines = config['available_pipelines'].map((i) => i[0]);
  let isValid = availablePipelines.includes(pipeline);
  if (!isValid) return startErrorOverlay(ctrl, 'Please select a pipeline');

  let parameters = generateComputationParameters(cObj['parameters']);
  parameters = JSON.stringify(parameters);
  let export_parameters = generateExportParameters(cObj['export_parameters']);
  let visual_export_parameters = generateVisualExportParameters(export_parameters);
  export_parameters = JSON.stringify([visual_export_parameters, export_parameters]);

  asdk.create_avatar(
    'test', photo, pipeline, subtype, parameters, export_parameters
  ).then(
    (avatar) => asdk.poll_avatar(avatar, onProgress)
  ).then(
    (avatar) => asdk.get_exports(avatar)
  ).then(
    (exports) => {
      _getAvatarExport(exports, asdk, 1).then(
        (exportObject) => fillExportsGUI(exportObject, asdk, config)
      );

      return _getAvatarExport(exports, asdk);
    }
  ).then(
    (exportObject) => visualizeExport(exportObject, asdk, config)
  ).then(
    () => endProcessingOverlay(ctrl)
  ).catch((err) => {
    console.log('catch error:', err);
    let msg = 'Something went wrong';

    if (!!err['status']) {
      msg = 'We couldn\'t compute avatar for this photo. Please try another one.';
    } else {
      msg = extractErrorMessage(err, msg);
    }

    startErrorOverlay(ctrl, msg);
  });
}


function fillExportsGUI(exportObject, asdk, config) {
  let exportFiles = exportObject['files'].reduce((a,i) => {
    let cat = i['category'] || 'avatar';
    let k = i['identity'];

    _getDefault(a, cat, {})[k] = i;

    return a;
  }, {});

  let container = config['exports_control'];
  while (container.childNodes.length > 0) container.removeChild(container.childNodes[0]);

  let controls = new GUI({'container': container, title: 'Exports'});
  let cObj = {};

  for (const [cat, catEntries] of Object.entries(exportFiles)) {
    let folder = controls.addFolder(_title(cat));
    let fObj = {};

    for (const [identity, ef] of Object.entries(catEntries)) {
      let cFolder = folder;

      let createCFolder = ef.static_files.length > 0 &&
          identity !== 'avatar';

      if (createCFolder) {
        cFolder = folder.addFolder(_title(identity));
      }

      _addFunctionGui(
        fObj, identity,
        () => downloadExportFile(asdk, ef['file'], identity + '.zip', config),
        cFolder, identity + '.zip'
      );

      for (const url of ef.static_files) {
        let filename = url.split('/');
        filename = filename[filename.length-1];

        _addFunctionGui(
          fObj, filename,
          () => downloadExportFile(asdk, url, filename, config),
          cFolder, filename
        );
      }
    }

    cObj['cat'] = fObj;
  }

  _showElement(config['exports_container']);

  return controls;
}


function visualizeExport(avatarExport, asdk, config) {
  let viewer = config['canvas'].parentElement;

  let avatarExportFile = undefined;

  for (const exportFile of avatarExport['files']) {
    if (exportFile['identity'] !== 'avatar') continue;

    avatarExportFile = exportFile;
    break;
  }

  if (!avatarExportFile) {
    startErrorOverlay(viewer, 'No avatar preview export file found');
    return;
  }


  _showElement(config['canvas_container']);
  let callbacks = startProcessingOverlay(viewer, true, 'Downloading', '');
  let onProgress = (stage, pct) => {
    callbacks['text'](stage);

    pct = (!!pct) ? pct + '%' : '';
    callbacks['progress'](pct);
  }

  asdk.get_export_file_contents(
    avatarExportFile, onProgress
  ).then(AvatarsGL.display).then(
    () => endProcessingOverlay(viewer)
  ).catch((err) => {
    let msg = extractErrorMessage(err, 'Something went wrong');
    startErrorOverlay(viewer, msg);
  });
}


function downloadExportFile(asdk, url, filename, config) {
  startProcessingOverlay(config['exports_control'], true, 'Downloading');

  asdk.download_export_file(url, filename, false).then((link) => {
    endProcessingOverlay(config['exports_control']);

    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      })
    );
  }).catch((err) => {
    let msg = extractErrorMessage(err, 'Something went wrong');
    startErrorOverlay(config['exports_control'], msg);
  });
}


// === ui ======================================================================

function _hideElement(target, hide=true) {
  let hidden = target.classList.contains('hidden');

  if (hide && !hidden) {
    target.classList.add('hidden');
  } else if (!hide && hidden) {
    target.classList.remove('hidden');
  }
}
let _showElement = (target) => _hideElement(target, false);


export function startProcessingOverlay(controlElement, indicator, text, progress) {
  let container = controlElement.parentElement;
  let overlay = container.querySelector('.processing-overlay');
  let indicatorElement = container.querySelector('.processing-indicator');
  let textElement = container.querySelector('.processing-text');
  let progressElement = container.querySelector('.processing-progress');

  let ret = {
    'text': (v) => textElement.innerHTML = v,
    'progress': (v) => progressElement.innerHTML = v,
  };

  if (!!indicator) {
    _showElement(indicatorElement);
  } else {
    _hideElement(indicatorElement);
  }

  if (text !== undefined) {
    ret['text'](text);
    _showElement(textElement);
  } else {
    _hideElement(textElement);
  }

  if (progress !== undefined) {
    ret['progress'](progress)
    _showElement(progressElement);
  } else {
    _hideElement(progressElement);
  }

  _showElement(overlay);

  return ret;
}

export function endProcessingOverlay(controlElement) {
  let container = controlElement.parentElement;
  let overlay = container.querySelector('.processing-overlay');
  let indicatorElement = container.querySelector('.processing-indicator');
  let textElement = container.querySelector('.processing-text');
  let progressElement = container.querySelector('.processing-progress');

  _hideElement(overlay);
  _hideElement(indicatorElement);
  _hideElement(textElement);
  _hideElement(progressElement);
}


export function startErrorOverlay(controlElement, text) {
  startProcessingOverlay(controlElement, null, text);

  let container = controlElement.parentElement;
  let overlay = container.querySelector('.processing-overlay');

  overlay.classList.add('error');

  container.querySelector('.processing-close').addEventListener('click', () => {
    endErrorOverlay(controlElement);
  })
}

export function endErrorOverlay(controlElement) {
  endProcessingOverlay(controlElement);

  let container = controlElement.parentElement;
  let overlay = container.querySelector('.processing-overlay');

  overlay.classList.remove('error');
}


function _addParameterGui(obj, key, value, folder, name) {
  obj[key] = value;
  let ctrl = folder.add(obj, key);
  if (!!name) ctrl.name(name);
  return ctrl;
}
let _addBooleanParameterGui = _addParameterGui;
let _addFunctionGui = _addParameterGui;


function _addAllNoneBtn(obj, key, folder) {
  obj[key] = false;

  let allNoneBtn = _addFunctionGui(
    {}, _ALL_NONE_KEY,
    () => {
      let current = !obj[key];

      folder.children.forEach((c) => {
        if (c === allNoneBtn) return;
        c.setValue(current);
      });
      allNoneBtn.name(current ? 'None' : 'All');

      obj[key] = current;
    },
    folder, 'All'
  )

  return allNoneBtn;
}


function _addEnableParameterGui(obj, key, value, folder, customValueAdd, name) {
  obj[key] = value;

  let ctrl = folder.add(value, 'enabled');
  ctrl.name('set_' + ((!!name) ? name : key));

  customValueAdd(folder, value, key, name);
}


function _customSizeAdd(folder, obj, key, name) {
  let v = obj['value'];
  let label = (!!name) ? name : key;

  folder.add(v, 'width', 0).name(label+'_w').step(1);
  folder.add(v, 'height', 0).name(label+'_h').step(1);
}


// === helpers =================================================================

export function extractErrorMessage(err, fallback=null) {
  let msg = fallback;

  if (!!err['detail']) {
    msg = err['detail'];
  } else if (!!err['statusText']) {
    msg = err['statusText'];
  }

  return msg;
}


function _makeGuiColorObj() {
  return {'r': 0, 'g': 0, 'b': 0};
}


function _convertGuiColor(v) {
  return {'red': v['r'], 'green': v['g'], 'blue': v['b']};
}


function _makeSizeObj() {
  return {'width': 0, 'height': 0};
}


function _makeEnableObj(v) {
  return {
    'enabled': false,
    'value': v,
  };
}


function _makeColorObj() {
  return _makeEnableObj(_makeGuiColorObj());
}


function _makeSizeEObj() {
  return _makeEnableObj(_makeSizeObj());
}


function _copy(obj) {
  // deep clone
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign#warning_for_deep_clone
  return JSON.parse(JSON.stringify(obj));
}


function _splitPipeline(value) {
  return value.split('|').map((p) => p.trim());
}


function _capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}


function _title(value) {
  return _capitalize(value.split('_').join(' '));
}


function _getDefault(obj, key, dflt) {
  if (!(key in obj)) {
    obj[key] = dflt;
  };

  return obj[key];
}


function _getRootFolder(gui, title) {
  for (const f of gui.folders) {
    if (f._title === title) return f;
  }
  return null;
}


function _emptyFolder(folder) {
  while (folder.children.length > 0) {
    folder.children[0].destroy()
  };

  return folder;
}


function _onAvatarProgress(callbacks, avatar) {
  callbacks?.text(avatar['status']);
  callbacks?.progress(avatar['progress'] + '%');
}


function _cmp(a, b) {
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
}


function _getAvatarExport(exports, asdk, idx=0) {
  if (idx > exports.length) return undefined;

  if (exports.length > 1) {
    exports.sort((a, b) => _cmp(a['created_on'], b['created_on']));
  }

  let aExport = exports[idx];
  let isCompleted = aExport['status'] === 'Completed';

  if (!isCompleted) return asdk.poll_export(aExport);

  return Promise.resolve(aExport);
}


function _delete_parameters_duplicates(parameters, exportParameters) {
  let subtype = Object.keys(parameters);
  if (!subtype.length) return parameters;
  subtype = subtype[0];

  Object.keys(exportParameters).forEach((epCat) => {
    let present = parameters[subtype].hasOwnProperty(epCat);
    if (!present) return;
    delete parameters[subtype][epCat];
  });

  return parameters;
}
