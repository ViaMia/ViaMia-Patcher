#!/usr/bin/env node

/**
 * ViaMia - Use your own keyboards with VIA
 * 
 * If VIA breaks that's your problem. If you ran this program, don't go complain to the VIA team.
 * I take no responsibility for any issues caused by this tool. Use it at your own risk.
 */

const inquirer = require('inquirer');
const os = require('os');
const fs = require('fs');
const path = require('path');
const asar = require('asar');
const plist = require('simple-plist');

let default_url = "https://viamia.github.io";
const myArgs = process.argv.slice(2);
if(myArgs[0] !== undefined){
    // TODO: check url validity
    default_url = myArgs[0];
}

async function Main(){
    console.log("ViaMia - v1.0.1");
    console.log("If you encounter any issues with VIA after running this tool, do not contact the VIA team. Contact ViaMia.");
    console.log(" ");
    console.log("Important: close VIA before continuing.");
    console.log(" ");

    let {confirmed} = await inquirer.prompt([
        {type: "confirm", name: "confirmed", "message": "I understand what I'm doing", default: true}
    ]);

    if(confirmed == false){ process.exit(0); }

    // Detecting user homedir
    let homedir = os.homedir();

    // Look for VIA install
    // TODO: make autodetection work on Mac & Linux
    let platform = os.platform();
    let possiblePath;
    if(platform == "win32"){
        possiblePath = path.join(homedir,"AppData","Local","Programs","via");
    } else if(platform == "darwin"){
        possiblePath = path.join("/", "Applications", "VIA.app")
    }

    let viaPath;
    if(possiblePath != undefined){
        if(fs.existsSync(possiblePath)){
            viaPath = possiblePath;
        }
    }

    // Autodetection failed ask for directory
    if(viaPath == undefined){
        console.log("Autodetection of the VIA install directory failed.");
        let {usrPath} = await inquirer.prompt([
            {type: "input", name: "usrPath", "message": "Please enter the path manually"}
        ]);

        if(fs.existsSync(usrPath)){
            viaPath = usrPath;
        }else{
            console.log("Path not found.");
            process.exit(0);
        }
    }

    // We now have a viaPath that's always defined
    console.log("VIA install found in: "+viaPath);
    let resources;
    if(platform == "win32"){
        resources = path.join(viaPath, "resources");
    } else if(platform == "darwin"){
        resources = path.join(viaPath, "Contents", "Resources")
    }
    let app_asar = path.join(resources, "app.asar");

    // Check if app.asar exists
    let exists = fs.existsSync(app_asar);
    if(!exists){
        let error_msg = "app.asar resources could not be found."
        if(platform=="darwin") {
            data = plist.readFileSync(path.join(viaPath,"Contents","info.plist"))
            console.warn("data is ", data)
            if(data.CFBundleShortVersionString.charAt(0)>1){
                error_msg += " "+"this script only works with VIA version 1";
            }
        } else {
            error_msg += " "+"Perhaps VIA was updated."
        }
        console.log(error_msg); process.exit(0);
    }

    // Backup app.asar
    fs.copyFileSync(app_asar, path.join(resources, "app.asar.bac"));
    console.log("Created a backup of the original VIA resources.");

    // Unpack asar
    console.log("Unpacking resources from ASAR (this may take a while).");
    let unpacked_dir = path.join(resources, 'app_unpacked');
    await asar.extractAll(app_asar, unpacked_dir);
    console.log("ASAR unpacked.");

    // Locate target file
    let targets = [];
    error_msg = "";
    targets.push(path.join(unpacked_dir, "app", "main.prod.js"));
    targets.push(path.join(unpacked_dir, "app", "dist", "renderer.prod.js"));
    targets.forEach(x => {
        if(!fs.existsSync(x)){ 
            error_msg = "Target file "+x+" could not be found."
            if(platform=="darwin") {
                data = plist.readFileSync(path.join(viaPath,"Contents","info.plist"))
                if(data.CFBundleShortVersionString.charAt(0) != 1){
                    error_msg += "\n"+"Found VIA v"+data.CFBundleShortVersionString+" "+"This script only works with VIA v1";
                }
            } else {
                error_msg += " "+"Perhaps VIA was updated."
            }
            console.log(error_msg);
    
            process.exit(0); }
    });

    // let {replaceWith} = await inquirer.prompt([
    //     {"type": "input", "name": "replaceWith", "message": "Replace VIA url with", "default": default_url}
    // ]);
    let replaceWith = default_url;

    for(const target of targets){
        await fileContentReplace(target, replaceWith);
    };
    console.log("All target files modified.");

    // Delete the original ASAR and pack the unpacked directory
    console.log("Repacking ASAR. Almost done.");
    fs.rmSync(app_asar);
    await asar.createPackage(unpacked_dir, app_asar);
    console.log("ASAR repacked. Cleaning up.");

    // Clean up unpacked files
    fs.rmSync(unpacked_dir, {recursive: true});

    console.log("Mod done, ViaMia out.");

}

async function fileContentReplace(file, replaceWith){
    let replaceRegex = /("keyboards\.v2\.json",")(.+?)(")/g;

    console.log("Reading file: "+file);
    let contents = (await fs.promises.readFile(file)).toString();
    contents = contents.replace(replaceRegex, "$1"+replaceWith+"$3");
    await fs.promises.writeFile(file, contents);
    console.log("Modded file: "+file);
}

Main();