try {
	var path = require('path');
	var rootDirPrefix = path.resolve('../..') + '/';
	var fs = require('fs');
	
	var pkgFile = rootDirPrefix + 'package.json'
	var stat = fs.statSync(pkgFile);
	if(stat.isFile()) {
		console.log('merging parent package.json with: ' + pkgFile);
		
		var pkg = JSON.parse(fs.readFileSync('package.json'));
		var overrides = JSON.parse(fs.readFileSync(pkgFile));
		var merge = function(main, override) {
			if(main instanceof Object) {
				var out = {};
				for(var prop in main) {
					if(prop in override) {
						out[prop] = merge(main[prop], override[prop]);
					}
					else {
						out[prop] = main[prop];
					}
				}
				for(var prop in override) {
					if(!(prop in out)) {
						out[prop] = override[prop];
					}
				}
				return out;
			}
			if(override !== undefined) {
				return override;
			}
			return main;
		};
		
		//console.log('deps: ' + JSON.stringify(npm_package_dependencies));
		console.log('deps2: ' + JSON.stringify(process.env.npm_package_dependencies));
		
		var out = merge(pkg, overrides);
		
		fs.writeFileSync('package.json', JSON.stringify(out));
	}
} catch(e) {
	console.log(e);
}
