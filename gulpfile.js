const GulpMeister = require('./gulpmeister');

const fakeProductionFlag = false;

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
    .addStyleEntry('./src/assets/styles/main.scss', 'main')
    .addStyleEntry('./src/assets/styles/critical.scss', 'second')
    .setDestinationPath('./dist/assets')
    .optional(
        fakeProductionFlag,
        productionContext => {
            productionContext.useMinify()
        }, developContext => {
            developContext
                .setBrowserSyncConfig(exampleBrowserSyncConfig)
                .writeSourcemap().useWatcher()
        })
    .build();
