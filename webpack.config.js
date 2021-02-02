/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");

const mode = process.env.NODE_ENV == "staging" ? "production" : (process.env.NODE_ENV || "development");

const firebaseconfigstr = ((env) => {
  switch (env) {
  case "staging":
  case "production":
    return process.env.FIREBASE_CONFIG_JSONSTR;
  case "development":
  default:
    return JSON.stringify(require("./config/dev/firebase.json"));
  }
})(process.env.NODE_ENV);

const twitterconfigstr = ((env) => {
  switch (env) {
  case "staging":
  case "production":
    return JSON.stringify({ key: process.env.TWITTER_CONSUMER_KEY, secret: process.env.TWITTER_CONSUMER_SECRET });
  case "development":
  default:
    return JSON.stringify(require("./config/dev/twitter.json"));
  }
})(process.env.NODE_ENV);

module.exports = [
  {
    mode,
    devtool: process.env.NODE_ENV == "production" ? false : "source-map",
    optimization: {
      minimize: process.env.NODE_ENV == "production",
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            mangle: true,
            // keep_fnames: true, // chomex.Modelには__nsを使っているので不要
          },
          extractComments: {
            condition: /^\**!|@preserve|@license|@cc_on/i,
          },
        }),
      ],
    },
    entry: {
      background: "./src/js/entrypoints/background.ts",
      popup:      "./src/js/entrypoints/popup.tsx",
      options:    "./src/js/entrypoints/options.tsx",
      capture:    "./src/js/entrypoints/capture.tsx",
      dashboard:  "./src/js/entrypoints/dashboard.tsx",
      deckcapture:"./src/js/entrypoints/deckcapture.tsx",
      archive:    "./src/js/entrypoints/archive.tsx",
      dmm:        "./src/js/entrypoints/dmm.ts",
      kcs2:       "./src/js/entrypoints/kcs2.ts",
      dsnapshot:  "./src/js/entrypoints/dsnapshot.tsx",
      tsworker:   "./node_modules/tesseract.js/dist/worker.min.js",
    },
    output: {
      path: path.resolve(__dirname, "./dest/js"),
      filename: "[name].js"
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: ["ts-loader"],
        },
      ]
    },
    resolve: {
      extensions: [".ts", ".js", ".tsx"]
    },
    plugins: [
      new webpack.DefinePlugin({
        "NODE_ENV": JSON.stringify(process.env.NODE_ENV),
        "FIREBASE_CONFIG": firebaseconfigstr,
        "TWITTER_CONFIG": twitterconfigstr,
      }),
    ],
    performance: {
      hints: false,
    },
  },
  {
    mode,
    entry: {
      capture:     "./src/css/entrypoints/capture.scss",
      common:      "./src/css/entrypoints/common.scss",
      options:     "./src/css/entrypoints/options.scss",
      popup:       "./src/css/entrypoints/popup.scss",
      dashboard:   "./src/css/entrypoints/dashboard.scss",
      dsnapshot:   "./src/css/entrypoints/dsnapshot.scss",
      deckcapture: "./src/css/entrypoints/deckcapture.scss",
      archive:     "./src/css/entrypoints/archive.scss",
    },
    output: {
      path: path.resolve(__dirname, "dest/css"),
    },
    module: {
      rules: [
        {
          test: /\.s?css$/,
          use: [
            MiniCssExtractPlugin.loader,
            { loader: "css-loader", options: { url: false } },
            "sass-loader",
          ],
        },
        // {
        //     test: /\.(eot|woff|woff2|ttf|svg)$/,
        //     loaders: ['url-loader']
        // },
      ]
    },
    resolve: {
      extensions: [".scss", ".css"]
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: "[name].css",
      }),
    ],
  }
];

