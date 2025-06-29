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
import {
    ProgressStream,
    RouteStackProps,
    createFileStreamFromUrl,
} from "../utils";

enum Stage {
    Downloading,
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

class EGateInstallState {
    installing = false;
    progress: Progress | undefined = undefined;
    log: string = "";

    options: Partial<PackageManagerInstallOptions> = {
        bypassLowTargetSdkBlock: false,
    };

    constructor() {
        makeAutoObservable(this, {
            progress: observable.ref,
            install: false,
            options: observable.deep,
        });
    }

    install = async () => {
        const apkUrl = "/egate.apk"; // Customize path if needed
        const filename = "eGate MDM";

        const response = await fetch(apkUrl);
        const blob = await response.blob();

        runInAction(() => {
            this.installing = true;
            this.progress = {
                filename,
                stage: Stage.Downloading,
                uploadedSize: 0,
                totalSize: blob.size,
                value: 0,
            };
            this.log = "";
        });

        const pm = new PackageManager(GLOBAL_STATE.adb!);
        const start = Date.now();

        const stream = blob.stream()
            .pipeThrough(new WrapConsumableStream())
            .pipeThrough(
                new ProgressStream(
                    action((uploaded) => {
                        if (uploaded !== blob.size) {
                            this.progress = {
                                filename,
                                stage: Stage.Downloading,
                                uploadedSize: uploaded,
                                totalSize: blob.size,
                                value: (uploaded / blob.size) * 0.8,
                            };
                        } else {
                            this.progress = {
                                filename,
                                stage: Stage.Installing,
                                uploadedSize: uploaded,
                                totalSize: blob.size,
                                value: 0.8,
                            };
                        }
                    })
                )
            );

        const log = await pm.installStream(blob.size, stream, this.options);

        const elapsed = Date.now() - start;
        await log.pipeTo(
            new WritableStream({
                write: action((chunk) => {
                    this.log += chunk;
                }),
            })
        );

        const rate = (blob.size / (elapsed / 1000) / 1024 / 1024).toFixed(2);
        this.log += `Install finished in ${elapsed}ms at ${rate}MB/s`;

        runInAction(() => {
            this.progress = {
                filename,
                stage: Stage.Completed,
                uploadedSize: blob.size,
                totalSize: blob.size,
                value: 1,
            };
            this.installing = false;
        });
    };
}

const state = new EGateInstallState();

const InstallEGate: NextPage = () => {
    return (
        <Stack {...RouteStackProps}>
            <Head>
                <title>eGate auto-installer - WADB</title>
            </Head>

            <PrimaryButton
                disabled={!GLOBAL_STATE.adb || state.installing}
                text="Install eGate MDM"
                onClick={state.install}
            />

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

export default observer(InstallEGate);
