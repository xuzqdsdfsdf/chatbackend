/* eslint valid-jsdoc: "off" */

'use strict';

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};
  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1615179137391_1928';

  // add your middleware config here
  config.middleware = ['errorHandle', 'auth'];
  config.auth = {
    ignore: ['/user/resign', '/user/login', '/ws','/common/upload']
  }
  // add your user config here
  const userConfig = {
    // myAppName: 'egg',
  };
  config.security = {
    // 关闭 csrf
    csrf: {
      enable: false,
    },
    // 跨域白名单
    domainWhiteList: [],
  };
  // 密码加密
  config.crypto = {
    secret: 'qhdgw@45ncashdaksh2!#@3nxjdas*_672'
  };
  config.jwt = {
    secret: 'qhdgw@45ncashdaksh2!#@3nxjdas*_672'
  };
  // 参数校验
  config.valparams = {
    locale: 'zh-cn',
    throwError: true
  };
  // 允许跨域的方法
  config.cors = {
    origin: '*',
    allowMethods: 'GET, PUT, POST, DELETE, PATCH'
  };
  // redius缓存配置
  config.redis = {
    client: {
      port: 6379,          // Redis port
      host: '127.0.0.1',   // Redis host
      password: '',
      db: 1,
    },
  }
  // 图片或者文件上传
  config.multipart = {
    mode: 'file',
    fileSize: '50mb'
  };
  // oss存储
  config.oss = {
    // client: {
    //   // 这里因为是我自己的阿里云accesskey为了安全考虑我就删除了需要的可以自己添加上去
    //   accessKeyId: '',
    //   accessKeySecret: '',
    //   bucket: '',
    //   endpoint: '',
    //   timeout: '60s',
    //   multipart: {
    //     mode: 'file',
    //     fileSize: '50mb'
    //   }
    // },
  }

  // 数据库配置
  config.sequelize = {
    dialect: 'mysql',
    host: '127.0.0.1',
    username: 'root',
    password: 'xzq980327',
    port: 3306,
    database: 'CWHonline',
    // 中国时区
    timezone: '+08:00',
    define: {
      // 取消数据表名复数
      freezeTableName: true,
      // 自动写入时间戳 created_at updated_at
      timestamps: true,
      // 字段生成软删除时间戳 deleted_at
      // paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      // deletedAt: 'deleted_at',
      // 所有驼峰命名格式化
      underscored: true
    }
  }

  return {
    ...config,
    ...userConfig,
  };
};
