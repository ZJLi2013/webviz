// @flow
//
//  Copyright (c) 2018-present, GM Cruise LLC
//
//  This source code is licensed under the Apache License, Version 2.0,
//  found in the LICENSE file in the root directory of this source tree.
//  You may not use this file except in compliance with the License.

import React, { PureComponent } from "react";
import Dimensions from "react-container-dimensions";
import { createSelector } from "reselect";
import { Time } from "rosbag";

import styles from "./PlotChart.module.scss";
import { getTimestampForMessage, type MessageHistoryItemsByPath } from "webviz-core/src/components/MessageHistory";
import TimeBasedChart, { type TimeBasedChartTooltipData } from "webviz-core/src/components/TimeBasedChart";
import filterMap from "webviz-core/src/filterMap";
import derivative from "webviz-core/src/panels/Plot/derivative";
import { type PlotPath, isReferenceLinePlotPathType } from "webviz-core/src/panels/Plot/internalTypes";
import { lightColor, lineColors } from "webviz-core/src/util/plotColors";
import { subtractTimes, format, formatTimeRaw, toSec } from "webviz-core/src/util/time";

export type PlotChartPoint = {|
  x: number,
  y: number,
  tooltip: TimeBasedChartTooltipData,
|};

export type DataSet = {|
  borderColor: string,
  borderWidth: number,
  data: Array<PlotChartPoint>,
  fill: boolean,
  key: string,
  label: string,
  pointBackgroundColor: string,
  pointBorderColor: string,
  pointHoverRadius: number,
  pointRadius: number,
  showLine: boolean,
|};

const Y_AXIS_ID = "Y_AXIS_ID";

function getDatasetFromMessagePlotPath(
  path: PlotPath,
  itemsByPath: MessageHistoryItemsByPath,
  index: number,
  startTime: Time
) {
  let points: PlotChartPoint[] = [];
  let showLine = true;

  for (const item of itemsByPath[path.value]) {
    const timestamp = getTimestampForMessage(item.message, path.timestampMethod);
    if (timestamp === null) {
      continue;
    }

    for (const { value, path, constantName } of item.queriedData) {
      const isTimeObj = value && typeof value === "object" && !isNaN(value.sec) && !isNaN(value.nsec);
      if (typeof value === "number" || typeof value === "boolean") {
        points.push({
          x: toSec(subtractTimes(timestamp, startTime)),
          y: Number(value),
          tooltip: { item, path, value, constantName, startTime },
        });
      } else if (isTimeObj) {
        const timeObj = { ...value };
        const valueStr = `${format(timeObj)} (${formatTimeRaw(timeObj)})`;
        points.push({
          x: toSec(subtractTimes(timestamp, startTime)),
          y: timeObj.sec + timeObj.nsec / 1e9,
          tooltip: { item, path, value: valueStr, constantName, startTime },
        });
      }
    }
    // If we have added more than one point for this message, make it a scatter plot.
    if (item.queriedData.length > 1) {
      showLine = false;
    }
  }

  if (path.value.includes(".@derivative")) {
    if (showLine) {
      points = derivative(points);
    } else {
      // If we have a scatter plot, we can't take the derivative, so instead show nothing
      // (nothing is better than incorrect data).
      points = [];
    }
  }

  return {
    borderColor: lineColors[index % lineColors.length],
    label: path.value,
    key: index.toString(),
    showLine,
    fill: false,
    borderWidth: 1,
    pointRadius: 1.5,
    pointHoverRadius: 3,
    pointBackgroundColor: lightColor(lineColors[index % lineColors.length]),
    pointBorderColor: "transparent",
    data: points,
  };
}

// A "reference line" plot path is a numeric value. It creates a horizontal line on the plot at the specified value.
function getAnnotationFromReferenceLine(path: PlotPath, index: number) {
  return {
    type: "line",
    drawTime: "beforeDatasetsDraw",
    scaleID: Y_AXIS_ID,
    label: path.value,
    borderColor: lineColors[index % lineColors.length],
    borderDash: [5, 5],
    borderWidth: 1,
    mode: "horizontal",
    value: Number.parseFloat(path.value),
  };
}

export function getDatasets(paths: PlotPath[], itemsByPath: MessageHistoryItemsByPath, startTime: Time): DataSet[] {
  return filterMap(paths, (path: PlotPath, index: number) => {
    if (!path.enabled) {
      return null;
    } else if (!isReferenceLinePlotPathType(path)) {
      return getDatasetFromMessagePlotPath(path, itemsByPath, index, startTime);
    }
    return null;
  });
}

function getAnnotations(paths: PlotPath[]) {
  return filterMap(paths, (path: PlotPath, index: number) => {
    if (!path.enabled) {
      return null;
    } else if (isReferenceLinePlotPathType(path)) {
      return getAnnotationFromReferenceLine(path, index);
    }
    return null;
  });
}

type YAxesInterface = {| minY: number, maxY: number, scaleId: string |};
// min/maxYValue is NaN when it's unset, and an actual number otherwise.
const yAxes = createSelector<YAxesInterface, _, _, _>(
  (params) => params,
  ({ minY, maxY, scaleId }: YAxesInterface) => {
    const min = isNaN(minY) ? undefined : minY;
    const max = isNaN(maxY) ? undefined : maxY;
    return [
      {
        id: scaleId,
        ticks: {
          min,
          max,
          precision: 3,
          callback: (val, idx, vals) =>
            idx === 0 || idx === vals.length - 1 ? "" : `${Math.round(val * 1000) / 1000}`,
        },
        gridLines: {
          color: "rgba(255, 255, 255, 0.2)",
          zeroLineColor: "rgba(255, 255, 255, 0.2)",
        },
      },
    ];
  }
);

type PlotChartProps = {|
  paths: PlotPath[],
  minYValue: number,
  maxYValue: number,
  saveCurrentYs: (minY: number, maxY: number) => void,
  datasets: DataSet[],
|};
export default class PlotChart extends PureComponent<PlotChartProps> {
  render() {
    const { paths, minYValue, maxYValue, saveCurrentYs, datasets } = this.props;
    const annotations = getAnnotations(paths);
    return (
      <div className={styles.root}>
        <Dimensions>
          {({ width, height }) => (
            <TimeBasedChart
              isSynced
              zoom
              width={width}
              height={height}
              data={{ datasets }}
              annotations={annotations}
              type="scatter"
              yAxes={yAxes({ minY: minYValue, maxY: maxYValue, scaleId: Y_AXIS_ID })}
              saveCurrentYs={saveCurrentYs}
            />
          )}
        </Dimensions>
      </div>
    );
  }
}
