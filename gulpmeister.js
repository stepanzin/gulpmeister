const gulp = require('gulp');
const postcss = require('gulp-postcss');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const del = require('del');
const gulpWebpack = require('webpack-stream');
const browserSync = require('browser-sync').create();
const { join } = require('path');
const Terser = require('terser-webpack-plugin');
const sass = require('gulp-sass');
const gulpIf = require("gulp-if");
const magicImporter = require('node-sass-magic-importer');

sass.compiler = require('sass');

function taskMarker(fn, name, description) {
    if (name) fn.displayName = name
    if (description) fn.description = description
    return fn
}

const TaskBuilder = {
    clean: (dest) => taskMarker(() => del(dest), 'clean', 'Clear output directory'),
    scripts: (entries, dest, scriptDir, webpackConfig, terserConfig, useSourcemaps, useMinify) => taskMarker(() => {
        const files = Object.values(entries);
        webpackConfig.entry = entries;
        webpackConfig.mode = useMinify ? 'production' : 'development';
        if (useSourcemaps) webpackConfig.devtool = 'cheap-source-map';
        terserConfig.sourceMap = useSourcemaps;
        if (useMinify) webpackConfig.plugins.push(new Terser(terserConfig));
        return gulp.src(files)
            .pipe(gulpWebpack(webpackConfig))
            .pipe(gulp.dest(join(dest, scriptDir)));
    }, 'scripts'),
    styles: (entries, dest, styleDir, postcssConfig, useSourcemaps, useMinify) => taskMarker(() => {
        const files = Object.values(entries)
        const reverse = Object.keys(entries).reduce((a, key) => ({ ...a, [entries[key]]: key }), {})
        const nameResolver = path => {
            console.log('resolver', path);
            const oldname = files.find(filename => filename.includes(path.basename))
            const newname = reverse[oldname];
            if (newname) path.basename = newname;
            return path;
        }

        const finaldest = join(dest, styleDir);

        return gulp.src(files)
            .pipe(rename(nameResolver))
            .pipe(gulpIf(useSourcemaps, sourcemaps.init()))
            .pipe(sass({ importer: magicImporter() }).on('error', sass.logError))
            .pipe(gulpIf(useSourcemaps, sourcemaps.write('.', { sourceRoot: finaldest })))
            .pipe(gulp.dest(finaldest))
    }, 'styles'),
    browserSync: (dest, browsersyncConfig) => taskMarker(() => {
        browserSync.init(browsersyncConfig);
        browserSync.watch(dest + '/**/*.*', browserSync.reload);
    }, 'browsersync'),
    watcher: (srcPath, styleTask, scriptTask) => taskMarker(() => {
        gulp.watch(join(srcPath, '/**/*.{scss, sass}'), styleTask);
        gulp.watch(join(srcPath, '/**/*.{js, mjs, es6}'), scriptTask);
    }, 'watcher'),
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
        this.browsersyncConfig = null
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
        this.postcssConfig = Object.assign({}, require('./postcss.config.js'))
        this.babelConfig = {}
        this.terserConfig = { sourceMap: false }
        this.flags = {
            serve: false,
            watch: false,
            minify: false,
            manifest: false,
            sourcemaps: false,
        }
    }

    setSourcePath(path) {
        this.sourcePath = path
        return this
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

    setBrowserSyncConfig(config) {
        this.browsersyncConfig = config
        this.flags.serve = this.flags.watch = true
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

    useMinify() {
        this.flags.minify = true
        return this
    }

    useWatcher() {
        this.flags.watch = true
        return this
    }

    writeManifest() {
        this.flags.manifest = true
        return this
    }

    writeSourcemap() {
        this.flags.sourcemaps = true
        return this
    }

    optional(condition, truth, falsy) {
        if (condition) truth(this)
        else falsy(this)
        return this
    }

    build() {
        const styles = TaskBuilder.styles(this.styleEntries, this.destinationPath, this.styleDir, this.postcssConfig, this.flags.sourcemaps, this.flags.minify)
        const scripts = TaskBuilder.scripts(this.scriptEntries, this.destinationPath, this.scriptDir, this.webpackConfig, this.terserConfig, this.flags.sourcemaps, this.flags.minify)
        const watchTasks = []
        if (this.flags.watch) watchTasks.push(TaskBuilder.watcher(this.sourcePath, styles, scripts))
        if (this.flags.serve) watchTasks.push(TaskBuilder.browserSync(this.browsersyncConfig))
        return gulp.task(this.taskName, gulp.series(
            TaskBuilder.clean(this.destinationPath),
            gulp.parallel(styles, scripts),
            gulp.parallel(...watchTasks)
        ));
    }
}
