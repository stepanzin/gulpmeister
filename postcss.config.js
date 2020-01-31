module.exports = function (ctx) {
    // look into gulpmeister.js styles task for contextOptions details
    // contextOptions is argument of postcss function (which exported from gulp-postcss)
    const options = ctx.options;
    const plugins = [
        require("autoprefixer")({ cascade: false }),
    ];

    if (options.useMinify) plugins.push(require('cssnano'));

    return {
        plugins,
    };
};
