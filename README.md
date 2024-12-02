<img align="Left" src="https://github.com/cpumaxx/sovits-ff-plugin/blob/main/icon.svg?raw=true" width="128"> 

<H1>Firefox Plugin for using GPT-SoVITS as a screen reader<BR><BR><BR></H1>

### Fully local and self contained: the ONLY network traffic is to the single API endpoint that you define

You can add this plugin by one of:

- using the signed xpi file provided
- zipping all the files and renaming the archive from .zip to .xpi (you could set up an account at https://addons.mozilla.org and sign your own if you want to eliminate errors) 
- putting about:debugging#/runtime/this-firefox in your address bar, using "Load Temporary Addon..." and pointing it at the manifest file

Change the plugin preferences to something like https://tts.yourdomain.com/api_v2 or whatever your actual domain is and make sure you have your sovits `api_v2.py` api running on that url.

If you want some of the API introspection quality-of-life improvements (listbox of available voice samples, etc) use my patched api_v2.py at https://github.com/cpumaxx/GPT-SoVITS/blob/main/api_v2.py

You may need to use the -c parameter to point to a custon YAML file that defines things like your preferred ckpt and pth files.

You need at least one character+emotion defined to use this plugin.

You will need to put any sound samples you want to use on your SoVITS server, in the same folder as the api_v2.py script.

Be very careful to use a high-quality voice samples between 3-10 seconds and set the "Prompt Text" to precisely what is being said in the sample.

You can set up SoVITS and get the required files from these resources:

https://github.com/RVC-Boss/GPT-SoVITS/

https://rentry.org/GPT-SoVITS-guide

https://huggingface.co/cpumaxx/SoVITS-anime-mini-tts

## Manual deployment for the privacy and security sensitive

   - Clone the project with `git clone https://github.com/cpumaxx/sovits-ff-plugin`
   - Change the manifest.js from `<all_urls>` to your API endpoint and change the ID (you can't re-use them since they will be rejected my Mozilla signing)
   - zip up the manifest, all the js/html/css/svg files and change the extension from `zip` to `xpi`
   - Sign the xpi file at https://addons.mozilla.org (you will need to create an account). Use the self-host option.
   - Go to "Extensions" in your Firefox, click on the gear, icon and "Install add-on from file"
