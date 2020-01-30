module.exports = {
    plugins: [
        require("postcss-easy-import")({ extensions: ".scss" }),
        require("autoprefixer")({ cascade: false }),
        require("postcss-nested"),
    ]
};