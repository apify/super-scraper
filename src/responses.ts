import { ServerResponse } from 'http';

const responses = new Map<string, ServerResponse>();

export const sendSuccResponseById = (responseId: string, result: string, contentType: string) => {
    const res = responses.get(responseId) as ServerResponse;
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(result);
    responses.delete(responseId);
};

export const sendErrorResponseById = (responseId: string, result: string) => {
    const res = responses.get(responseId) as ServerResponse;
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(result);
    responses.delete(responseId);
};

export const addResponse = (responseId: string, response: ServerResponse) => {
    responses.set(responseId, response);
};
