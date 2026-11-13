//@ts-check

'use strict';

const base = require('../webpack.config');

/** @type {import('webpack').Configuration} */
const config = {
  ...base,
  entry: './src/cli.ts',
  output: {
    ...base.output,
    filename: 'cli.js',
  },
};

module.exports = config;
