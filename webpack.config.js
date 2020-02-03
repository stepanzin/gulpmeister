module.exports = {
    output: {
        filename: "[name].js",
        chunkFilename: "[contenthash].module.js"
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
    plugins: [],
    module: {
        rules: [{
            loader: "babel-loader",
        }]
    },
};
