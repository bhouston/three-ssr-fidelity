import { ssr as normalBias } from './SSRNode-pr28.js';
import { ssr as rayGuard } from './SSRNode-pr29.js';
import { ssr as samplingDocs } from './SSRNode-pr30.js';
import { ssr as dielectric } from './SSRNode-pr32.js';
import { ssr as backDepth } from './SSRNode-pr33.js';

export const stockSSRFactories = { 28: normalBias, 29: rayGuard, 30: samplingDocs, 32: dielectric, 33: backDepth };
