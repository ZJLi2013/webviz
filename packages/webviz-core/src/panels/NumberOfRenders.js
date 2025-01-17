// @flow
//
//  Copyright (c) 2018-present, GM Cruise LLC
//
//  This source code is licensed under the Apache License, Version 2.0,
//  found in the LICENSE file in the root directory of this source tree.
//  You may not use this file except in compliance with the License.
import * as React from "react";
import { hot } from "react-hot-loader/root";

import Flex from "webviz-core/src/components/Flex";
import MessageHistory from "webviz-core/src/components/MessageHistory";
import { type MessagePipelineContext, useMessagePipeline } from "webviz-core/src/components/MessagePipeline";
import Panel from "webviz-core/src/components/Panel";
import PanelToolbar from "webviz-core/src/components/PanelToolbar";
import * as PanelAPI from "webviz-core/src/PanelAPI";
import inScreenshotTests from "webviz-core/src/stories/inScreenshotTests";

// Little dummy panel that just shows the number of renders that happen when not subscribing
// to anything. Useful for debugging performance issues.
let panelRenderRenderCount = 0;
let messageHistoryRenderCount = 0;
let useMessagesRenderCount = 0;
let messagePipelineRenderCount = 0;

window.getNumberOfRendersCountsForTests = function() {
  return {
    panelRenderRenderCount,
    messageHistoryRenderCount,
    useMessagesRenderCount,
    messagePipelineRenderCount,
  };
};

function HooksComponent() {
  PanelAPI.useMessages({
    topics: [],
    restore: React.useCallback(() => null, []),
    addMessage: React.useCallback(() => null, []),
  });
  return `useMessagesRenderCount: ${++useMessagesRenderCount}`;
}

function MessagePipelineRendersComponent() {
  // This is a private API, so panels should not be using it, but it's still bad if it renders too
  // much. And in practice there might still be some panels that use it directly. :-(
  useMessagePipeline<MessagePipelineContext>((context: MessagePipelineContext) => context);
  return `messagePipelineRenderCount: ${++messagePipelineRenderCount}`;
}

function NumberOfRenders(): React.Node {
  panelRenderRenderCount++;
  return (
    <Flex col>
      <PanelToolbar />
      <Flex row center style={{ fontSize: 20, lineHeight: 1.5, textAlign: "center" }}>
        <MessageHistory paths={[]}>
          {() => (
            <>
              panelRenderRenderCount: {panelRenderRenderCount} <br />
              messageHistoryRenderCount: {++messageHistoryRenderCount}
            </>
          )}
        </MessageHistory>
        <br />
        <HooksComponent />
        <br />
        {!inScreenshotTests() && <MessagePipelineRendersComponent /> // Too flakey for screenshots.
        }
      </Flex>
    </Flex>
  );
}

NumberOfRenders.panelType = "NumberOfRenders";
NumberOfRenders.defaultConfig = {};

export default hot(Panel<{}>(NumberOfRenders));
