import { DebugVariable, AblDebugKind, isPrimitiveType } from './variables';

export interface DebugMessage {
    code: string;
    args: string[][];
}
export interface DebugMessageListing extends DebugMessage {
    code: string;
    args: string[][];
    breakpointCount: number;
    file: string;
    stoppedAtLine: number;
    breakpoints: DebugMessageListingBreapoint[];
}
export interface DebugMessageClassInfo extends DebugMessage {
    baseClass: string;
    properties?: DebugVariable[];
}
export interface DebugMessageArray extends DebugMessage {
    values: string[];
}
export interface DebugMessageVariables extends DebugMessage {
    variables: DebugVariable[];
}
export interface DebugMessageListingBreapoint {
    line: number;
    id: number;
}

export function convertDataToDebuggerMessage(data: any): DebugMessage[] {
    let messages: string = data.toString();
    return messages.split('\0').filter(msg => msg.length > 0).map(msg => {

        let idxCode = msg.indexOf(';');
        let msgCode = msg;
        let args = [];
        if (idxCode !== -1) {
            msgCode = msg.slice(0, idxCode);
            msg = msg.substr(idxCode + 1);

            // specific args convertion
            if (msgCode === 'MSG_LISTING') {
                args = msg.split(';').filter(p => p.length > 0);
                let msgConverted: DebugMessageListing = {
                    code: msgCode,
                    args: [],
                    breakpointCount: parseInt(args[4]),
                    file: args[0],
                    stoppedAtLine: parseInt(args[5]),
                    breakpoints: []
                };

                for (let bpIdx = 0; bpIdx < msgConverted.breakpointCount; bpIdx++) {
                    msgConverted.breakpoints.push({
                        line: args[6 + bpIdx * 2],
                        id: args[6 + (bpIdx * 2) + 1]
                    });
                }
                return msgConverted;
            }
            else if (msgCode === 'MSG_CLASSINFO') {
                msg = msg.replace(/\n/g, '');
                args = msg.split(';').filter(p => p.length > 0);
                let msgConverted: DebugMessageClassInfo = {
                    code: msgCode,
                    args: [],
                    baseClass: args[3] === 'Y' ? args[4] : null,
                    properties: []
                };
                args = args.slice(5);
                let propCount = args.length / 6;
                for (let propIdx = 0; propIdx < propCount; propIdx++) {
                    // args[propIdx * 6 + 0] : P:public, V:private
                    // args[propIdx * 6 + 3] : ??
                    // args[propIdx * 6 + 4] : R, RW
                    let variable = {
                        children: [],
                        kind: AblDebugKind.Variable,
                        name: args[propIdx * 6 + 1],
                        type: args[propIdx * 6 + 2],
                        value: args[propIdx * 6 + 5]
                    };
                    if (!isPrimitiveType(variable.type)) {
                        variable.kind = AblDebugKind.Class;
                    }
                    msgConverted.properties.push(variable);
                }
                return msgConverted;
            }
            else if (msgCode === 'MSG_VARIABLES') {
                let parts1 = msg.split('\n').filter(p => p.length > 0);
                args = parts1.map(p => p.split(';')).filter(p => p.length > 0);
                let msgConverted: DebugMessageVariables = {
                    code: msgCode,
                    args: [],
                    variables: []
                };
                msgConverted.variables = args.map(p => {
                    if (p[2] !== '?') { // if not empty, it's a class
                        return {
                            name: p[0],
                            type: p[2],
                            kind: AblDebugKind.Class,
                            value: p[6],
                            children: []
                        };
                    } else if (p[4] !== '0') { // if > 0 this is an Extent (Array)
                        return {
                            name: p[0],
                            type: p[1],
                            kind: AblDebugKind.Array,
                            value: p[6],
                            children: []
                        };
                    } else {
                        return {
                            name: p[0],
                            type: p[1],
                            kind: AblDebugKind.Variable,
                            value: p[6],
                            children: []
                        };
                    }
                });
                return msgConverted;
            }
            else if (msgCode === 'MSG_ARRAY') {
                msg = msg.replace(/\n/g, '');
                args = msg.split(';').slice(1).filter((value, index) => {
                    return (index + 1) % 3 === 0;
                }).map(v => v.replace(/\u0012/g, ''));
                let msgConverted: DebugMessageArray = {
                    code: msgCode,
                    args: [],
                    values: <string[]>args
                };
                return msgConverted;
            } else if (msgCode === 'MSG_PARAMETERS') {
                let parts1 = msg.split('\n').filter(p => p.length > 0);
                args = parts1.map(p => p.split(';')).filter(p => p.length > 0);
                let msgConverted: DebugMessageVariables = {
                    code: msgCode,
                    args: [],
                    variables: []
                };
                msgConverted.variables = args.map(p => {
                    let displayName = p[1];
                    if (p[0] === 'OUTPUT') {
                        displayName = '\u2190' + displayName;
                    } else if (p[0] === 'INPUT') {
                        displayName = '\u2192' + displayName;
                    } else if (p[0] === 'INPUT-OUTPUT') {
                        displayName = '\u2194' + displayName;
                    }
                    return {
                        name: displayName,
                        type: p[2],
                        kind: AblDebugKind.Parameter,
                        value: p[5],
                        children: []
                    };
                });
                return msgConverted;
            } else {
                let parts1 = msg.split('\n').filter(p => p.length > 0);
                args = parts1.map(p => p.split(';')).filter(p => p.length > 0);
            }
        }
        return { code: msgCode, args: args };
    });
}
