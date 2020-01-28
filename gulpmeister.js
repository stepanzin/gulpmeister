const gulp = require('gulp');
const postcss = require('gulp-postcss');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const del = require('del');
const gulpWebpack = require('webpack-stream');
const browserSync = require('browser-sync').create();
const { join } = require('path');
const Terser = require('terser-webpack-plugin');

const TaskBuilder = {
    clean: (dest) => () => del(dest),
    scripts: (entries, dest, scriptDir, webpackConfig, terserConfig, useSourcemaps, useMinify) => () => {
        const files = Object.values(entries)
        webpackConfig.entry = entries
        webpackConfig.mode = useMinify ? 'production' : 'development'
        terserConfig.sourceMap = useSourcemaps
        if (useMinify) webpackConfig.plugins.push(new Terser(terserConfig))
        return gulp.src(files)
            .pipe(gulpWebpack(webpackConfig))
            .pipe(gulp.dest(join(dest, scriptDir)));
    },
    styles: (entries, dest, styleDir, postcssConfig, useSourcemaps, useMinify) => () => {
        const files = Object.values(entries)
        const reverse = Object.keys(entries).reduce((a, key) => ({ ...a, [entries[key]]: key }), {})
        const nameResolver = path => {
            const oldname = files.find(filename => filename.includes(path.basename + path.extname))
            path.basename = reverse[oldname];
            path.extname = '.css';
            return path;
        }
        
        // TODO: need assign?
        let task = gulp.src(files)
        if (useSourcemaps) task = task.pipe(sourcemaps.init())
        if (useMinify) postcssConfig.plugins.push(require("cssnano")())
        console.log(postcssConfig)
        task = task.pipe(postcss(postcssConfig))
        if (useSourcemaps) task = task.pipe(sourcemaps.write())
        return task
            .pipe(rename(nameResolver))
            .pipe(gulp.dest(join(dest, styleDir)))
    },
    browserSync: (dest, browsersyncConfig) => () => {
        browserSync.init(browsersyncConfig);
        browserSync.watch(dest + '/**/*.*', browserSync.reload);
    },
    watcher: (srcPath, styleTask, scriptTask, useVue) => () => {
        const scriptExts = ['js', 'mjs', 'es6'];
        if (useVue) scriptExts.push('vue');
        gulp.watch(srcPath + '/**/*.{scss, sass}', styleTask);
        gulp.watch(srcPath + `/**/*.{${scriptExts.join(', ')}}`, scriptTask);
    },
    manifestGenerator: () => () => {},
}

module.exports = class GulpMeister {
    constructor(taskName = 'default') {
        this.taskName = taskName
        this.sourcePath = null
        this.destinationPath = null
        this.styleDir = './'
        this.scriptDir = './'
        this.styleEntries = {}
        this.scriptEntries = {}
        this.browsersyncConfig = {}
        this.webpackConfig = {
            output: {
                filename: "[name].js",
                chunkFilename: "[name].module.js"
            },
            optimization: {
                splitChunks: {
                    cacheGroups: {
                        commons: {
                            test: /[\\/]node_modules[\\/]/,
                            name: 'vendors',
                            chunks: 'all'
                        }
                    }
                }
            },
            plugins: []
        }
        this.postcssConfig = Object.assign({ syntax: 'postcss-scss', plugins: [] }, require('./postcss.config.js'))
        this.babelConfig = {}
        this.terserConfig = { sourceMap: false }
        this.flags = {
            watch: false,
            minify: false,
            manifest: false,
            sourcemaps: false,
        }
    }

    setDestinationPath(path) {
        this.destinationPath = path
        return this
    }

    setScriptDir(dir) {
        this.scriptDir = dir
        return this
    }

    setStyleDir(dir) {
        this.styleDir = dir
        return this
    }

    setWebpackConfig(config) {
        this.webpackConfig = config
        return this
    }

    setPostCSSConfig(config) {
        this.postcssConfig = config
        return this
    }

    setBabelConfig(config) {
        this.babelConfig = config
        return this
    }

    setTerserConfig(config) {
        this.terserConfig = config
        return this
    }

    addStyleEntry(path, name) {
        this.styleEntries[name] = path
        return this
    }

    addScriptEntry(path, name) {
        this.scriptEntries[name] = path
        return this
    }

    useMinify(flag = true) {
        this.flags.minify = flag
        return this
    }

    useWatcher(browsersyncConfig) {
        this.browsersyncConfig = browsersyncConfig
        this.flags.watch = true
        return this
    }

    writeManifest(flag = true) {
        this.flags.manifest = flag
        return this
    }

    writeSourcemap(flag = true) {
        this.flags.sourcemaps = flag
        return this
    }

    build() {
        // console.log(this)
        return gulp.task(this.taskName, gulp.series(
            TaskBuilder.clean(this.destinationPath),
            gulp.parallel(
                TaskBuilder.styles(this.styleEntries, this.destinationPath, this.styleDir, this.postcssConfig, this.flags.sourcemaps, this.flags.minify),
                TaskBuilder.scripts(this.scriptEntries, this.destinationPath, this.scriptDir, this.webpackConfig, this.terserConfig, this.flags.sourcemaps, this.flags.minify)
            )//,
            // gulp.parallel(TaskBuilder.watcher(), TaskBuilder.browserSync())
        ));
    }
}
