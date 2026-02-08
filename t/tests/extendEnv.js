import _ from 'lodash';

const extendEnv = (env, cb) => {
  if (env) {
    Object.assign(process.env, env);
  }
  cb();
  if (env) {
    _.omit(process.env, Object.keys(env));
  }
};

export default extendEnv;
