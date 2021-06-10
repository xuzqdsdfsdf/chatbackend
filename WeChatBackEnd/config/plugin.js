'use strict';

/** @type Egg.EggPlugin */
module.exports = {
  // had enabled by egg
  // static: {
  //   enable: true,
  // }
  cors: {
    enable: true,
    package: 'egg-cors'
  },
  sequelize: {
    enable: true,
    package: 'egg-sequelize',
  },
  jwt: {
    enable: true,
    package: "egg-jwt"
  },
  valparams:{
    enable:true,
    package: 'egg-valparams',
  },
  redius:{
    enable:true,
    package:'egg-redis'
  },
  websocket:{
    enable:true,
    package: 'egg-websocket-plugin'
  },
  exports : {
    enable: true,
    package: 'egg-oss',
  },
  multipart:{
    enable:true,
    package:'egg-multipart'
  },
  qrImage:{
    enable:true,
    package:'qr-image'
  }
};
