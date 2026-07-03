import BoardPage from "./BoardPage";
import type { ComponentProps } from "react";

interface ALevelBoardPageProps extends ComponentProps<typeof BoardPage> {
  // Inherits all BoardPage props; adds default csvSuffix="al"
}

export default function ALevelBoardPage(props: ALevelBoardPageProps) {
  return <BoardPage {...props} csvSuffix={props.csvSuffix ?? "al"} />;
}
