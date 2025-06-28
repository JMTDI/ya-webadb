import {
    PrimaryButton,
    ProgressIndicator,
    Stack,
} from "@fluentui/react";
import {
    PackageManager,
    PackageManagerInstallOptions,
} from "@yume-chan/android-bin";
import { WrapConsumableStream, WritableStream } from "@yume-chan/stream-extra";
import { action, makeAutoObservable, observable, runInAction } from "mobx";
import { observer } from "mobx-react-lite";
import { NextPage } from "next";
import Head from "next/head";
import { GLOBAL_STATE } from "../state";
import { ProgressStream, RouteStackProps } from "../utils";

enum Stage {
    Downloading,
    Uploading,
    Installing,
    Completed,
}

interface Progress {
    filename: string;
    stage: Stage;
    uploadedSize: number;
    totalSize: number;
    value: number | undefined;
}

class EgateInstallPageState {
    installing = false;
    progress: Progress | undefined = undefined;
    log: string = "";
    options: Partial<PackageManagerInstallOptions> = {
        bypassLowTargetSdkBlock: false,
    };

    // TODO: Replace with your actual eGate MDM APK URL
    egateApkUrl =
        "https://your-domain.com/path/to/egate-mdm.apk";

    constructor() {
        makeAutoObservable(this, {
            progress: observable.ref,
            install: false,
            options: observable.deep,
        });
    }

    install = async () => {
        if (!GLOBAL_STATE.adb) {
            this.log = "No device connected!";
            return;
        }

        const filename = this.egateApkUrl.split("/").pop() ?? "egate-mdm.apk";
        runInAction(() => {
            this.installing = true;
            this.progress = {
                filename,
                stage: Stage.Downloading,
                uploadedSize: 0,
                totalSize: 0,
                value: 0,
            };
            this.log = "";
        });

        // Download the APK
        let apkBlob: Blob;
        try {
            const response = await fetch(this.egateApkUrl);
            if (!response.ok) throw new Error("Failed to download APK");
            const data = await response.blob();
            apkBlob = data;
        } catch (err: any) {
            runInAction(() => {
                this.log = `Download failed: ${err.message || err}`;
                this.installing = false;
            });
            return;
        }

        const fileSize = apkBlob.size;
        runInAction(() => {
            if (this.progress) {
                this.progress.stage = Stage.Uploading;
                this.progress.totalSize = fileSize;
                this.progress.value = 0;
            }
        });

        const pm = new PackageManager(GLOBAL_STATE.adb!);

        const start = Date.now();
        const log = await pm.installStream(
            fileSize,
            apkBlob
                .stream()
                .pipeThrough(new WrapConsumableStream())
                .pipeThrough(
                    new ProgressStream(
                        action((uploaded: number) => {
                            if (uploaded !== fileSize) {
                                this.progress = {
                                    filename,
                                    stage: Stage.Uploading,
                                    uploadedSize: uploaded,
                                    totalSize: fileSize,
                                    value: (uploaded / fileSize) * 0.8,
                                };
                            } else {
                                this.progress = {
                                    filename,
                                    stage: Stage.Installing,
                                    uploadedSize: uploaded,
                                    totalSize: fileSize,
                                    value: 0.8,
                                };
                            }
                        })
                    )
                ),
            this.options as PackageManagerInstallOptions
        );

        const elapsed = Date.now() - start;
        await log.pipeTo(
            new WritableStream({
                write: action((chunk: string) => {
                    this.log += chunk;
                }),
            })
        );

        const transferRate = (
            fileSize /
            (elapsed / 1000) /
            1024 /
            1024
        ).toFixed(2);
        this.log += `Install finished in ${elapsed}ms at ${transferRate}MB/s\n`;

        runInAction(() => {
            this.progress = {
                filename,
                stage: Stage.Completed,
                uploadedSize: fileSize,
                totalSize: fileSize,
                value: 1,
            };
            this.installing = false;
        });
    };
}

const state = new EgateInstallPageState();

const EgateInstall: NextPage = () => {
    return (
        <Stack {...RouteStackProps} tokens={{ childrenGap: 16 }}>
            <Head>
                <title>eGate MDM Auto-Install - ya-webadb</title>
            </Head>

            <Stack horizontal>
                <PrimaryButton
                    disabled={!GLOBAL_STATE.adb || state.installing}
                    text="Auto-Install eGate MDM"
                    onClick={state.install}
                />
            </Stack>

            {state.progress && (
                <ProgressIndicator
                    styles={{ root: { width: 300 } }}
                    label={state.progress.filename}
                    percentComplete={state.progress.value}
                    description={Stage[state.progress.stage]}
                />
            )}

            {state.log && <pre>{state.log}</pre>}
        </Stack>
    );
};

export default observer(EgateInstall);
