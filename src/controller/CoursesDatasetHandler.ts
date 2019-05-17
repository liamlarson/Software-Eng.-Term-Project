import {InsightDataset, InsightError} from "./IInsightFacade";
import Log from "../Util";
import JSZip = require("jszip");

export default class CoursesDatasetHandler {

    public static getCoursesData (id: string, content: string) {

        return new Promise((resolveCoursesData, reject) => {
            let jszip = new JSZip();
            jszip.loadAsync(content, {base64: true})
                .then((zip: JSZip) => {
                    let allFiles: any = [];
                    let folder = zip.folder(/\/*courses\//);
                    if (folder.length === 0) {
                        reject(new InsightError("No courses folder"));
                    }
                    zip.folder(folder[0].name).forEach(function (relativePath, file) {
                        allFiles.push(file.async("text"));
                    });
                    return allFiles;
                }).then((allFiles) => {
                Promise.all(allFiles).then((files: any) => {
                    let data: object[] = [];
                    for (let file of files) {
                        if (file) {
                            try {
                                let course = JSON.parse(file);
                                let sectionList = course.result;
                                sectionList.forEach(function (section: any) {
                                    try {
                                        let sectionJson = CoursesDatasetHandler.parseSection(id, section);
                                        data.push(sectionJson);
                                    } catch (e) {
                                        Log.warn("Can't parse section: " + section);
                                    }
                                });
                            } catch (e) {
                                Log.warn("Can't parse file: " + file);
                            }
                        }
                    }

                    if (data.length === 0) {
                        return reject(new InsightError("No valid sections"));
                    }

                    return resolveCoursesData(data);
                });
            }).catch((err: any) => {
                return reject(new InsightError("Cannot process zip file"));
            });
        });
    }

    public static parseSection(id: any, section: any): Promise<object> {
        let dict = {
            Subject: id + "_dept",
            Course: id + "_id",
            Avg: id + "_avg",
            Professor: id + "_instructor",
            Title: id + "_title",
            Pass: id + "_pass",
            Fail: id + "_fail",
            Audit: id + "_audit",
            id: id + "_uuid",
            Year: id + "_year"
        };

        let sectionString: string = "{";
        sectionString += "\"" + dict.Subject + "\"" + ":" + "\"" + section.Subject + "\"" + ",";
        sectionString += "\"" + dict.Course + "\"" + ":" + "\"" + section.Course + "\"" + ",";
        sectionString += "\"" + dict.Avg + "\"" + ":" + section.Avg + ",";
        sectionString += "\"" + dict.Professor + "\"" + ":" + "\"" + section.Professor + "\"" + ",";
        sectionString += "\"" + dict.Title + "\"" + ":" + "\"" + section.Title + "\"" + ",";
        sectionString += "\"" + dict.Pass + "\"" + ":" + section.Pass + ",";
        sectionString += "\"" + dict.Fail + "\"" + ":" + section.Fail + ",";
        sectionString += "\"" + dict.Audit + "\"" + ":" + section.Audit + ",";
        sectionString += "\"" + dict.id + "\"" + ":" + "\"" + section.id + "\"" + ",";
        if (section.Section === "overall") {
            sectionString += "\"" + dict.Year + "\"" + ":" + 1900;
        } else {
            sectionString += "\"" + dict.Year + "\"" + ":" + section.Year;
        }
        sectionString += "}";
        // Log.trace(sectionString);
        try {
            return JSON.parse(sectionString);
        } catch (e) {
            throw e;
        }
    }
}
