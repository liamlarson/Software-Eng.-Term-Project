import Log from "../Util";
import DatasetHandler from "./DatasetHandler";
import {IInsightFacade, InsightDataset, InsightDatasetKind, ResultTooLargeError} from "./IInsightFacade";
import {InsightError, NotFoundError} from "./IInsightFacade";
import QueryValidator from "./QueryValidator";
import CoursesDatasetHandler from "./CoursesDatasetHandler";
import RoomsDatasetHandler from "./RoomsDatasetHandler";
import QueryHandler from "./QueryHandler";
import TransformationHandler from "./TransformationHandler";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
// Add dataset failing?
// possum: invalid dataset to query
// sunergy: should reject
export default class InsightFacade implements IInsightFacade {

    private datasets: Map<InsightDataset, object[]>;

    constructor() {
        this.datasets = new Map<InsightDataset, object[]>();
        Log.trace("InsightFacadeImpl::init()");
    }

    public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
        return new Promise (  (resolve: any, reject: any) => {
            if (!DatasetHandler.validId(id)) {
                return reject(new InsightError("Invalid id"));
            }
            DatasetHandler.datasetExists(id).then((value) => {
                if (value) {
                    return reject(new InsightError("Dataset already exists"));
                }
                if (kind === InsightDatasetKind.Courses) {

                    CoursesDatasetHandler.getCoursesData(id, content).then((data: object[]) => {
                        const dataset: InsightDataset = {id: id, kind: kind, numRows: data.length};
                        this.datasets.set(dataset, data);
                        DatasetHandler.saveDataset(dataset, data).then(() => {
                            // let datasets = [...this.datasets.keys()].map((d) => d.id);
                            // resolve(datasets);
                            this.listDatasets().then((datasets: any) => {
                                let idArray = [];
                                for (let ds of datasets) { idArray.push(ds.id); }
                                return resolve(idArray);
                            });
                        }).catch((e) => {
                            return reject(e);
                        });
                    }).catch((e) => {
                        return reject(e);
                    });
                } else if (kind === InsightDatasetKind.Rooms) {
                    RoomsDatasetHandler.getAllRoomsData(id, content).then((data: object[]) => {
                        const dataset: InsightDataset = {id: id, kind: kind, numRows: data.length};
                        this.datasets.set(dataset, data);
                        DatasetHandler.saveDataset(dataset, data).then(() => {
                            this.listDatasets().then((datasets: any) => {
                                let idArray = [];
                                for (let ds of datasets) { idArray.push(ds.id); }
                                return resolve(idArray);
                            });
                        }).catch((e) => {
                            return reject(e);
                        });
                    }).catch((e) => {
                        return reject(e);
                    });
                } else {
                    return reject(new InsightError("Invalid dataset kind"));
                }
            });
        });
    }

    public removeDataset(id: string): Promise<string> {

        return new Promise((resolve, reject) => {
            if (!DatasetHandler.validId(id)) {
                return reject(new InsightError("Invalid id"));
            }
            try {
                let keys = Array.from(this.datasets.keys());
                let deleted = false;
                keys.forEach((key: InsightDataset) => {
                    if (key.id === id) {
                        this.datasets.delete(key);
                        deleted = true;
                    }
                });

                DatasetHandler.deleteDatasets(id).then( (deletedFromDisk: boolean) => {
                    if (deleted || deletedFromDisk) {
                        return resolve(id);
                    }
                    return reject(new NotFoundError("Could not find the dataset to delete"));
                });
            } catch (err) {
                return reject(new InsightError("Error deleting dataset"));
            }
        });
    }

    public performQuery(query: any): Promise <any[]> {
        return new Promise((resolve, reject) => {
            try {
                if (typeof query !== "object" || !query.WHERE || !query.OPTIONS) {
                    return reject(new InsightError("Query must be object"));
                }
            } catch (e) {
                return reject(new InsightError("Query must be object"));
            }

            let datasetToQuery = QueryHandler.getDatasetToQuery(query.WHERE, query.OPTIONS);
            if (!DatasetHandler.isDatasetInMemory(datasetToQuery, this.datasets)) {
                try {
                    let cachedDataset: any = DatasetHandler.loadDataset(datasetToQuery);
                    this.datasets.set(cachedDataset.dataset, cachedDataset.data);
                } catch (e) { return reject(e); }
            }
            let data;
            try {
                data = DatasetHandler.getDataset(datasetToQuery, this.datasets);
            } catch (e) { return reject(e); }

            let results;
            try {
                results = QueryHandler.filterResults(datasetToQuery, query.WHERE, data);
            } catch (e) { return reject (new InsightError(e.message)); }

            if (results.length === 0) {
                return resolve([]);
            }

            if (query.TRANSFORMATIONS) {
                results = TransformationHandler.transform(query.OPTIONS, query.TRANSFORMATIONS, results, data);
            }

            if (results.length > 5000) {
                return reject(new ResultTooLargeError("Greater than 5000 results"));
            }

            results = QueryHandler.filterColumns(datasetToQuery, query.OPTIONS, results);
            results = QueryHandler.orderResults(query.OPTIONS, results);
            resolve(results);
        });
    }

    public listDatasets(): Promise<InsightDataset[]> {

        return new Promise ( async (resolve: any, reject: any) => {
            await DatasetHandler.listDatasets().then((savedDatasets) => {
                for (let savedDatasetId of savedDatasets) {
                    let found = false;
                    for (let key of this.datasets.keys()) {
                        if (key.id === savedDatasetId) {
                            found = true;
                        }
                    }
                    if (!found) {
                        let cachedDataset: any = DatasetHandler.loadDataset(savedDatasetId);
                        this.datasets.set(cachedDataset.dataset, cachedDataset.data);
                    }
                }

                let keys = this.datasets.keys();
                let keyArray: InsightDataset[] = Array.from(keys);
                resolve(keyArray);
            }).catch((e) => {
                let keys = this.datasets.keys();
                let keyArray: InsightDataset[] = Array.from(keys);
                resolve(keyArray);
            });
        });
    }
}
