const GulpMeister = require('./gulpmeister')

new GulpMeister()
    .setDestinationPath('./dist/assets')
    .addScriptEntry('./src/assets/scripts/works.js', 'main')
    .addScriptEntry('./src/assets/scripts/auth.js', 'auth')
    .addStyleEntry('./src/assets/styles/main.scss', 'main')
    .addStyleEntry('./src/assets/styles/critical.scss', 'second')
    .writeSourcemap(true)
    .useMinify(true)
    .build()
