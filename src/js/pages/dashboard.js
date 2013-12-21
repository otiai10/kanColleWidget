(function(){
    "use strict";

    if (Config.get('tiredness-recovery-minutes') == 0) $('#tiredness-contents').hide();

    var timersView = new widgetPages.TimersView();
    var tirednessListView = new widgetPages.TirednessListView();
    var mainClockView = new widgetPages.MainClockView();
    $("#page0").append(
        mainClockView.render(),
        timersView.render(),
        tirednessListView.render()
    );
    setInterval(function(){
        mainClockView.update();
    }, 1000);

    var questListView = new widgetPages.QuestListView(new KanColleWidget.Quests());
    $("#page1").append(
        questListView.render()
    );

    var memoView = new widgetPages.MemoView();
    $("div#recipe-memo-container").append(memoView.render());
    // {{{ おいおいーい
    $("textarea#recipe-memo").on("keyup",function(ev){
        memoView.saveRecipeMemo(ev);
    });
    // }}}


    if (Config.get('clockmode-style') == 1) {//Tab Style
        var sideNaviView = new widgetPages.SideNaviView();
        $('#wrapper').append(sideNaviView.render());
        widgetPages.SideNaviView.adjustToSideNavi();
    }

    setInterval(function(){
        timersView.update();
        tirednessListView.update();
        if (questListView.haveUpdate()) questListView.update();
    },5000);
})();
