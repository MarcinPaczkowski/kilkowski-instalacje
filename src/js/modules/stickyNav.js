$(window).load(function(){
  $(".navigation").sticky({ topSpacing: 0, center:true, className:"stickyNav", responsiveWidth:true });
});


//problem jest taki ze:
//primo - sama strona w ogole chujowo sie laduje :o
//sekundo - jak ustawilem diva na width 100% to plugin ustawia szerokosc na max! a to jest za duzo bo nie bierze pod uwage
