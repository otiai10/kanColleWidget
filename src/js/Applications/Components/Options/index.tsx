import React, { Component } from "react";

import NotificationSettings from "./Notifications";
import ScreenshotSettingView from "./Screenshot";
import DamageSnapshotSettingView from "./DamageSnapshot";
import InAppButtonSettingView from "./InAppButton";

// webpack.config.jsの、DefinePluginを参照
declare let NODE_ENV;
import Debugger from "./Debugger";
import AnnounceView from "./Announce";
import DashboardDesignView from "./DashboardDesign";

export default class OptionsPage extends Component {
  render() {
    return (
      <div className="container options">
        <AnnounceView />
        <NotificationSettings />
        <DashboardDesignView />
        <DamageSnapshotSettingView />
        <ScreenshotSettingView />
        <InAppButtonSettingView />
        {NODE_ENV == "production" ? null : <Debugger />}
      </div>
    );
  }
}