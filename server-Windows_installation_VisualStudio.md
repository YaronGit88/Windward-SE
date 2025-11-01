START the service with :  npm start.
if in viusal studio CMD terminal  use:  start npm start

make sure Node JS version is 18.2.  not  version 19  as it is not  yet supported  by leaflet maps.
can modify PORT on .end file.


 Node.JS Installations
===================================================================================
PS mksir C:\yelp\server
PS C:\yelp> cd .\server\
 npm init -y
 npm  install
 npm install express 
 npm install dotenv
 npm install nodemon
 npm install --save-dev cross-env
 npm install react-router-dom

under Client directory react:
==============================================================================
npx create-react-app client
npm install --save-dev concurrently

MAP TOOLS
========================================================================
npm install leaflet react-leaflet
npm install mapbox-gl react-map-gl
npm ls leaflet react-leaflet


Windows
=======================================================================
$env:NODE_OPTIONS="--openssl-legacy-provider"
start cmd
start npm start


CMD: set NODE_OPTIONS=--openssl-legacy-provider

Linux
====================================================================================
export NODE_OPTIONS=--openssl-legacy-provider
npm start
