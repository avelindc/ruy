import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./resolve-extension-loader.mjs', pathToFileURL(`${process.cwd()}/tests/`));
