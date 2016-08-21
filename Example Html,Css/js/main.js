$(document).ready(function(){
  $('.bxslider').bxSlider({
    pagerCustom: '#bx-pager',
    nextSelector: '#slider-next',
    prevSelector: '#slider-prev',
    nextText: '<img src="../img/next.png" height="10px" width="10px">',
    prevText: '<img src="../img/prev.png" height="10px" width="10px">'
  });
});