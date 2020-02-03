const GulpMeister = require('./gulpmeister');
const argv = require('yargs').argv;

let isProduction = argv.prod || false;
let isWatchEnabled = argv.watch || false;
let isLiveReloadEnabled = argv.serve || false;

const exampleBrowserSyncConfig = {
    port: 3304,
    server: './dist',
    logPrefix: 'BrowserSync',
    logConnections: true,
};

new GulpMeister()
    .setSourcePath('./src/assets')
    .addScriptEntry('./src/assets/scripts/works.js', 'main')
    .addScriptEntry('./src/assets/scripts/auth.js', 'auth')
    .addScssEntry('./src/assets/styles/*.scss', 'unnecessary_name')
    .setDestinationPath('./dist/assets')
    .optional(isProduction, ctx => ctx.useMinify())
    .optional(isWatchEnabled, ctx => ctx.useWatcher())
    .optional(isLiveReloadEnabled, ctx => ctx.setBrowserSyncConfig(exampleBrowserSyncConfig))
    .build();
