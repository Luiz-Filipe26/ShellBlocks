import transparent from "../assets/icons/transparent.svg";
import info from "../assets/icons/info-icon.svg";
import fileTextWhite from "../assets/icons/file-text-white.svg";
import alertYellow from "../assets/icons/triangle-alert-yellow.svg";
import errorRed from "../assets/icons/octagon-x-red.svg";

export const Assets = {
    Icons: {
        Empty: transparent,
        Info: info,
        FileText: fileTextWhite,
        Warning: alertYellow,
        Error: errorRed
    }
} as const;
