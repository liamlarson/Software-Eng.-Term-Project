import fs = require("fs");
import {InsightDataset, InsightError} from "./IInsightFacade";
import Log from "../Util";
import path = require("path");

export default class DatasetHandler {

    public static datasetExists(id: string): Promise<boolean> {
        return new Promise(function (resolveDatasetExists, reject) {
            DatasetHandler.listDatasets().then((savedDatasets) => {
                savedDatasets.forEach((dataset) => {
                    if (dataset === id) {
                        resolveDatasetExists(true);
                    }
                });
            }).then(() => {
                resolveDatasetExists(false);
            });
        });
    }

    public static saveDataset(dataset: InsightDataset, data: object[]): Promise<string[]> {
        return new Promise(function (resolveSaveDataset, reject) {

            if (!fs.existsSync(__dirname + "/../../data/")) {
                fs.mkdirSync(__dirname + "/../../data/");
            }

            let file = fs.createWriteStream(__dirname + "/../../data/" + dataset.id + ".json");
            file.on("error", function (err) {
                reject(new InsightError("Cannot save dataset"));
            });
            let datasetJson = {dataset: dataset, data: data};
            file.write(JSON.stringify(datasetJson).concat("\n"));
            file.end();

            resolveSaveDataset(DatasetHandler.listDatasets());
        });
    }

    public static validId(id: string): any {
        return !(id === null || id.length < 1);
    }

    public static deleteDatasets(id: string): Promise<boolean> {
        return new Promise((resolveDeleteDataset, reject) => {
            try {
                fs.unlinkSync(__dirname + "/../../data/" + id + ".json");
                resolveDeleteDataset(true);
            } catch (err) {
                resolveDeleteDataset(false);
            }
        });
    }

    public static listDatasets(): Promise<string[]> {
        return new Promise(function (resolveListDataset, reject) {
            fs.readdir(__dirname + "/../../data/", function (err, files) {
                let datasets: string[] = [];
                try {
                    files.forEach((file) => {
                        datasets.push(path.parse(file).name);
                    });
                } catch (e) {
                  resolveListDataset ([]);
                }
                return resolveListDataset(datasets);
            });
        });
    }

    public static loadDatasets(): Map<InsightDataset, object[]> {
        let allFiles: any;
        try {
            allFiles = fs.readdirSync(__dirname + "/../../data/");
        } catch (e) {
            return new Map<InsightDataset, object[]>();
        }
        let datasets: Map<InsightDataset, object[]> = new Map<InsightDataset, object[]>();

        allFiles.map((file: any) => {
            try {
                let dataset = JSON.parse(fs.readFileSync(__dirname + "/../../data/" + file, "utf8"));
                if (dataset.dataset && dataset.data) {
                    datasets.set(dataset.dataset, dataset.data);
                }
            } catch (e) {
                Log.warn("Failed to read dataset " + file);
            }
        });

        return datasets;
    }

    public static loadDataset(id: any): Map<InsightDataset, object[]> {
        try {
             return JSON.parse(fs.readFileSync(__dirname + "/../../data/" + id + ".json", "utf8"));
        } catch (e) {
            throw new InsightError("Dataset does not exist");
        }
    }

    // Return the dataset with the given id
    public static getDataset(dataid: string, Datasets: Map<InsightDataset, object[]>) {
        let keys = Datasets.keys();
        let keyArray: InsightDataset[] = Array.from(keys);
        for (let x = 0; x < Datasets.size; x++) {
            if (keyArray[x].id === dataid) {
                return Datasets.get(keyArray[x]);
            }
        }
        throw new InsightError("No Dataset by this name");
    }

    public static isDatasetInMemory (id: any, datasets: any) {
        for (let dataset of datasets.keys()) {
            if (dataset.id === id) {
                return true;
            }
        }

        return false;
    }
}
