var AV = require('leanengine');

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', function(request, response) {
	response.success('Hello world!');
});

/**
 * 登录
 */
AV.Cloud.define('login', function(req, res) {
	var username = req.param("username");
	var password = req.param("password");
	AV.User.logIn(username, password).then(function() {
		// 成功了，现在可以做其他事情了
		res.success('登录成功');
	}, function() {
		// 失败了
		res.error('登录失败');
	});
});

module.exports = AV.Cloud;