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


export class AvatarSDK {
  constructor(token, url) {
    this.token = token;
    this._auth_header = 'Bearer ' + token;
    this.base_url = url;

    this._x_user_agent = 'asdk.js/0.1 (' + window.location.host + ')';
  };

  _url(url) {
    return new URL(url, this.base_url);
  };

  _performRequest(url, fetchObj={}) {
    let headers = fetchObj['headers'] || {};
    headers['Authorization'] = this._auth_header;
    headers['X-User-Agent'] = this._x_user_agent;
    fetchObj['headers'] = headers;

    return fetch(url, fetchObj);
  }

  _jsonResponse(responsePromise) {
    return new Promise((resolve, reject) => {
      responsePromise.then((rsp) => {
        if (!rsp.ok) {
          return rsp.json().then((j) => {
            return reject(j)
          }).catch((e) => {
            return reject(rsp);
          })
        }

        return rsp.json().then(resolve);
      })
    })
  }

  get_available_parameters(pipeline, subtype) {
    let url = this._url('/parameters/available/' + pipeline + '/');
    url.searchParams.append('pipeline_subtype', subtype);

    return this._jsonResponse(
      this._performRequest(url)
    )
  };

  get_available_export_parameters(pipeline, subtype) {
    let url = this._url('/export_parameters/available/' + pipeline + '/');
    url.searchParams.append('pipeline_subtype', subtype);

    return this._jsonResponse(
      this._performRequest(url)
    );
  };

  create_avatar(name, photo, pipeline, subtype, parameters, export_parameters) {
    let form = new FormData();

    form.append('name', 'test');
    form.append('photo', photo, photo.name);
    form.append('pipeline', pipeline);
    form.append('pipeline_subtype', subtype);
    form.append('parameters', parameters);
    form.append('export_parameters', export_parameters);

    let url = this._url('/avatars/');

    return this._jsonResponse(
      this._performRequest(url, {
        'method': 'POST',
        'body': form,
      })
    );
  };

  get_avatar(avatar) {
    let url = avatar['url'];

    return this._jsonResponse(
      this._performRequest(url)
    );
  }

  _poll_impl(avatar, resolve, reject, onProgress, iIntervalGetter) {
    this.get_avatar(avatar).then((j) => {
      let code = j['code'];
      let status = j['status'];
      let progress = j['progress'];

      if (!!onProgress) onProgress(j);

      switch (status) {
      case 'Completed':
        clearInterval(iIntervalGetter());
        return resolve(j);
      case 'Failed':
      case 'Timed Out':
        clearInterval(iIntervalGetter());
        return reject(j);
      case 'Pending':
      case 'Uploading':
      case 'Queued':
      case 'Computing':
        break;
      default:
        console.log('unknown status "%s"', status);
      }
    }).catch((err) => {
      console.log(err);

      clearInterval(iIntervalGetter());
      return reject(err);
    })
  }

  poll_avatar(avatar, onProgress) {
    return new Promise((resolve, reject) => {
      let iInterval = null;
      iInterval = setInterval(
        this._poll_impl.bind(this), 5000,
        avatar, resolve, reject, onProgress, () => iInterval
      );
    });
  }

  get_exports(avatar) {
    let url = avatar['exports'];

    return this._jsonResponse(
      this._performRequest(url)
    );
  }

  poll_export(avatarExport, onProgress) {
    return new Promise((resolve, reject) => {
      let iInterval = null;
      iInterval = setInterval(
        this._poll_impl.bind(this), 5000,
        avatarExport, resolve, reject, onProgress, () => iInterval
      );
    });
  }

  download_export_file(url, filename, useBlob=false) {
    if (useBlob) {
      return this._performRequest(url).then(
        (r) => r.blob()
      ).then((b) => {
        let fBlob = new File([b], filename, {'type': b.type});
        let bUrl = URL.createObjectURL(fBlob);

        const link = document.createElement('a');
        link.href = bUrl;
        link.download = filename;

        return link;
      });
    } else {
      let href = new URL(url);
      href.searchParams.append('access_token', this.token);

      const link = document.createElement('a');
      link.href = href;
      link.download = filename;

      return Promise.resolve(link);
    }
  }
};
