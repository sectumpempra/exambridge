import BoardPage from "./BoardPage";
import type { ComponentProps } from "react";

export default function ALevelBoardPage(props: ComponentProps<typeof BoardPage>) {
  return <BoardPage {...props} csvSuffix={props.csvSuffix ?? "al"} />;
}
