# AvatarSDK WEB API JS sample

In this sample, you could find how to query the available avatar
computation/export parameters, create an avatar computation task, poll
its status and download avatar export files using JavaScript.


## How to start

You will need to complete the following steps before experimenting
with this sample:

  * Get AvatarSDK developer account at
    https://accounts.avatarsdk.com/developer/signup/
  * Create an application with Client credentials Authorization Grant
    at https://accounts.avatarsdk.com/developer/
  * Copy `client_id` and `client_secret` from the Client Access
    application at https://accounts.avatarsdk.com/developer/

Now you are ready to go:

  * Clone this repository to your computer
  * Run `serve.sh` script to start a simple web server (requires
    `python3` installed) and navigate to http://localhost:9000
  * Fill `client_id` and `client_secret` fields with the corresponding
    values from the Developer page above and click Authorize button
  * See running requests in your browser developer tools


## How it works

[asdk.js](js/asdk.js) wraps API calls, since every request must include
`Authorization` header. It also parses JSON responses and handles
request errors. Every `AvatarSDK` method returns a `Promise`

[avatars_ui.js](js/avatars_ui.js) wraps UI/UX. It initializes
`AvatarSDK` and then:
  * build avatar computation and export parameters forms dynamically,
    based on API response (see `fillParametersGui` and
    `fillExportParametersGui`)
  * visualize selected parameters (see `generateComputationParameters`
    and `generateExportParameters`)
  * generate additional export parameters for avatar visualization,
    based on the selected export parameters (i.e. predefined format
    and textures parameters and the first asset from
    haircuts/outfits. See `generateVisualExportParameters`)
  * create and poll avatar computation task (see `onComputeAvatar`)
  * visualize avatar (see `visualizeExport`)
  * build available export files form (see `fillExportsGUI`)
  * download export files (see `downloadExportFile`)

[avatars_gl.js](js/avatars_gl.js) wraps 3D rendering. It initializes
the rendering scene, controls, and adds avatar model into the scene
properly (i.e. adjust some material properties, see
`_adjustMeshProperties`). _Please note_: only GLB with embedded meshes
and textures are supported now, so we add the second group of export
parameters to request this format of mesh simultaneously with the
user-selected ones (see `generateExportParameters` at
[avatars_ui.js](js/avatars_ui.js)).

[main.js](js/main.js) wraps authorization UI/UX. Please see the note
on authorization below.

This sample uses the following libraries:
  * [lil-gui](https://lil-gui.georgealways.com) for the GUI
  * [three.js](https://threejs.org/) for the 3D
  * [JSZip](https://stuk.github.io/jszip/) for ZIP archives handling


## Note on the authorization

Avatar SDK WEB API uses OAuth 2.0 for authorization. The authorization
token retrieval form is present here purely for the sample
purpose. Production code must keep `client_id` and `client_secret` 
secret, perform authorization on the server-side and provide
frontend only with `access_token` (i.e. pass the `token` within
`config` into `avatars_ui.js :: init(config)` call).


## License

The 3-Clause BSD License

See [LICENSE.md](LICENSE.md)
