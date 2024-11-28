# sovits-ff-plugin
# Firefox Plugin for using GPT-SoVITS as a screen reader

You can add this plugin from the interface you get putting about:debugging#/runtime/this-firefox in your address bar, using "Load Temporary Addon..." and pointing it at the manifest file.

Change the plugin preferences to something like https://tts.yourdomain.com/api_v2 or whatever your actual domain is and make sure you have your sovits `api_v2.py` api running on that url.
You may need to use the -c parameter to point to a custon YAML file that defines things like your preferred ckpt and pth files.

You can set up SoVITS and get the required files from https://huggingface.co/cpumaxx/SoVITS-anime-mini-tts
