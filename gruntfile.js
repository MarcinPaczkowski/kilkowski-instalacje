module.exports = function(grunt){

	require("matchdep").filterDev("grunt-*").forEach(grunt.loadNpmTasks);

	grunt.initConfig({

		pkg: grunt.file.readJSON('package.json'),

		/**
		 * Define structure paths
		 */
		paths: {
			'bower': 'bower_components',
			'dist': 'dist',
			'src': 'src'
		},

		/**
		 * Compile all .less files
		 */
		less: {
			options: {
				paths: [
					"<%= paths.bower %>/bootstrap/less",
					"<%= paths.bower %>/components-font-awesome/less",
				]
			},
			normal: {
				files: {
					"<%= paths.dist %>/css/styles.css": ['<%= paths.src %>/less/*.less']
				}
			},
			min: {
				options: {
					cleancss: true,
					report: 'min'
				},
				files: {
					"<%= paths.dist %>/css/styles.min.css": ['<%= paths.src %>/less/*.less']
				}
			}
		},

		/**
		 * Merege all scripts
		 * into one file
		 */
		concat: {
			options: {
				separator: ';'
			},
			dist: {
				files: {
					'<%= paths.dist %>/js/scripts.js': [
						'<%= paths.src %>/js/**/*.js'
					]
				}
			}
		},

		/**
		 * Minify mereged script file
		 */
		uglify: {
			options: {
				report: 'min'
			},
			dist: {
				files: [{
					'<%= paths.dist %>/js/scripts.min.js': [
						'<%= paths.dist %>/js/scripts.js'
					]
				}],
			}
		},

		imagemin: {
			dynamic: {
				files: [{
					expand: true,
					flatten: true,
					src: '<%= paths.src %>/images/**/*.{png,jpg,jpeg,gif}',
					dest: '<%= paths.dist %>/images'
				}]
			}
		},

		/**
		 * Copy files
		 */
		copy: {
			html: {
				expand: true,
				flatten: true,
				src: '<%= paths.src %>/*.html',
				dest: '<%= paths.dist %>',
			},
			fonts: {
				expand: true,
				flatten: true,
				src: '<%= paths.src %>/fonts/**/*',
				dest: '<%= paths.dist %>/fonts/',
			},
			components: {
				files: [
					{
						expand: true,
						flatten: true,
						cwd: '<%= paths.bower %>/',
						src: [
							'modernizr/modernizr.js',
							'jquery/dist/jquery.min.js',
							'jquery/dist/jquery.min.map',
							'bootstrap/dist/js/bootstrap.min.js'
						],
						dest: '<%= paths.dist %>/js/vendor/'
					},
				]
			},
		},

		/**
		 * Set watch
		 */
		watch: {
			css: {
				files: ['<%= paths.src %>/less/**/*.{css,less}'],
				tasks: ['build-css']
			},
			js: {
				files: ['<%= paths.src %>/js/**/*.js'],
				tasks: ['build-js']
			},
			img: {
				files: ['<%= paths.src %>/images/**/*.{jpg,jpeg,png,gif,svg}'],
				tasks: ['build-img']
			},
			html: {
				files: ['<%= paths.src %>/*.html'],
				tasks: ['build-html']
			}
		}
	});

	/**
	 * Register grunt tasks
	 */
	grunt.registerTask('default', [
		'less',
		'concat',
		'uglify',
		'copy',
		'imagemin',
		'watch'
	]);

	grunt.registerTask('build-css', [
		'less', 'copy:fonts'
	]);

	grunt.registerTask('build-js', [
		'concat', 'uglify', 'copy'
	]);

	grunt.registerTask('build-img', [
		'imagemin'
	]);

	grunt.registerTask('build-html', [
		'copy:html'
	]);

};