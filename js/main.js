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


import GUI from './lil-gui.esm.min.js';
import * as AvatarsUI from './avatars_ui.js';

const AUTH_URL = 'https://api.avatarsdk.com/o/token/';
const API_URL = 'https://api.avatarsdk.com/';
const PIPELINES = [
  ['head_1.2', ['base/static', 'base/legacy', 'base/mobile']],
  ['head_2.0', ['bust/mobile', 'bust/static', 'head/mobile']],
  ['body_0.3', ['mobile', 'female', 'male']],
];


document.addEventListener('DOMContentLoaded', main);


export function main() {
  init_auth_ui(AUTH_URL, init_avatars_ui);
}


function init_auth_ui(auth_url, on_authorized) {
  let auth_control = document.querySelector('#auth_control');
  let stored_client_id = localStorage.getItem('client_id');
  let stored_client_secret = localStorage.getItem('client_secret');
  let stored_token = localStorage.getItem('access_token');

  let cObj = {
    'client_id': stored_client_id || '',
    'client_secret': stored_client_secret || '',
    'token': '',
  };

  if (!!stored_token) {
    stored_token = JSON.parse(stored_token);

    let expired = _now() >= stored_token.expires - 60*5;
    if (!expired) {
      cObj['token'] = stored_token.access_token;

      if (!!on_authorized) {
        on_authorized(stored_token.access_token);
      }
    }
  }

  let controls = new GUI({container: auth_control, title: 'Authorization'});
  controls.add(cObj, 'client_id');
  controls.add(cObj, 'client_secret');
  let token_ctrl = controls.add(cObj, 'token').disable();

  cObj['auth'] = () => auth(cObj, auth_url, on_authorized, auth_control, token_ctrl);
  controls.add(cObj, 'auth').name('Authorize');
}


function init_avatars_ui(token) {
  let config = {
    app_api: API_URL,
    token: token,
    available_pipelines: PIPELINES,
    pipelines_container: document.getElementById('pipelines_container'),
    pipelines_control: document.getElementById('pipelines_control'),
    jsons_container: document.getElementById('jsons_container'),
    exports_control: document.getElementById('exports_control'),
    parameters_json: document.getElementById('parameters_json'),
    export_parameters_json: document.getElementById('export_parameters_json'),
    exports_container: document.getElementById('exports_container'),
    canvas_container: document.getElementById('canvas_container'),
    canvas: document.getElementById('canvas'),
  };

  AvatarsUI.init(config);
}


function auth(config, auth_url, on_authorized, auth_control, token_ctrl) {
  AvatarsUI.startProcessingOverlay(auth_control, true);

  let client_id = config['client_id']
  if (!client_id) {
    return AvatarsUI.startErrorOverlay(auth_control, 'Empty client_id');
  }
  let client_secret = config['client_secret']
  if (!client_secret) {
    return AvatarsUI.startErrorOverlay(auth_control, 'Empty client_secret');
  }

  localStorage.setItem('client_id', client_id);
  localStorage.setItem('client_secret', client_secret);

  let auth_form = new FormData();
  auth_form.append('grant_type', 'client_credentials');

  let auth = 'Basic ' + btoa(client_id + ':' + client_secret);

  let headers = {
    'Authorization': auth,
  }

  return fetch(auth_url, {
    'headers': headers,
    'method': 'POST',
    'body': auth_form,
  }).then(
    (rsp) => rsp.json()
  ).then((rsp) => {
    AvatarsUI.endProcessingOverlay(auth_control);

    token_ctrl.setValue(rsp.access_token);
    rsp.expires = _now() + rsp.expires_in;
    localStorage.setItem('access_token', JSON.stringify(rsp));

    if (!!on_authorized) {
      on_authorized(rsp.access_token);
    }
  }).catch((err) => {
    let msg = AvatarsUI.extractErrorMessage(err, 'Something went wrong');
    AvatarsUI.startErrorOverlay(auth_control, msg);
  });
}


function _now() {
  return Math.round(Date.now()/1000);
}
