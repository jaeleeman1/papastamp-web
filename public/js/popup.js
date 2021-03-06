function dEI(elementID){
    return document.getElementById(elementID);
}

//레이어 팝업 열기
function openLayer(IdName, tpos, lpos, height){
    var pop = dEI(IdName);
    pop.style.top = tpos + "px";
    pop.style.left = lpos + "px";
    pop.style.display = "block";

    var wrap = dEI("wrapper");
    var reservation = document.createElement("div");
    reservation.setAttribute("id", "deemed");
    wrap.appendChild(reservation);
    $('#wrapper').on('scroll touchmove mousewheel', function(event) {
        event.preventDefault();
        event.stopPropagation();
        return false;
    });
    $('#deemed').css('height', height+'px');
}

//레이어 팝엽 닫기
function closeLayer( IdName ){
    var pop = dEI(IdName);
    pop.style.display = "none";
    var clearEl=parent.dEI("deemed");
    var momEl = parent.dEI("wrapper");
    momEl.removeChild(clearEl);
    $('#wrapper').off('scroll touchmove mousewheel');
    var shopId = $("#shop_id").val();
    if(document.getElementById(shopId)){
        document.getElementById(shopId).scrollIntoView();
    }
}

function openMapLayer( IdName ){
    var mapPop = dEI(IdName);
    mapPop.style.display = "block";
}

function closeMapLayer( IdName ) {
    var mapPop = dEI(IdName);
    mapPop.style.display = "none";
}