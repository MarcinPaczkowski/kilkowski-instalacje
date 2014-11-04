$(document).ready(function(){
	// sticky menu
	$(".navigation").sticky({ topSpacing: 0, center:true, className:"stickyNav", responsiveWidth:true });

	// carousel
	$("#owl-mySlider").owlCarousel({ 
		autoPlay: 3000,
		slideSpeed : 300,
		paginationSpeed : 400,
		singleItem: true,
	});
});