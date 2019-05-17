import {InsightDataset} from "./IInsightFacade";
import {InsightDatasetKind} from "./IInsightFacade";

export default class Dataset implements InsightDataset {

    public id: string;
    public kind: InsightDatasetKind;
    public numRows: number;
    public data: object[];
}
