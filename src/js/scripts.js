$(document).ready(function(){
	//auto size to screen
	var screenHeight = $(window).height();
	$(".welcomePage__background").css("height", screenHeight);

	$(window).resize(function() {
		var screenHeight = $(window).height();
		$(".welcomePage__background").css("height", screenHeight);
	});

	console.log(screenHeight);
	// slider carousel
	$("#owl-mySlider").owlCarousel({ 
		autoPlay: 3000,
		slideSpeed : 300,
		paginationSpeed : 400,
		singleItem: true,
	});

	//scrollTo
	$(".navigation__logo a").click(function() {
		var target = this.hash;
		$.smoothScroll({
          scrollTarget: target
        });
	});

	$(".navigation__menu .menu-link").click(function() {
		var target = this.hash;
		$.smoothScroll({
          scrollTarget: target,
          offset: -95
        });
	});

	//services show/hide banner	
	$(".services__banner").children().first().show();
	$(".list-item").click(function() {
		$idName = $(this).find(".ico").attr("id");
		$(".services__banner img").fadeOut("slow").finish();
		$(".services__banner").find("." + $idName).fadeIn("slow");
	});

	//colorBox popUp
	$(".gallery-item--popUp").colorbox({rel:'gallery-item--popUp'});	
});