import { BrowserMessageReader, BrowserMessageWriter, createConnection, ProposedFeatures } from 'vscode-languageserver/browser';
import { setConnection } from './connection';

setConnection(createConnection(ProposedFeatures.all, new BrowserMessageReader(self), new BrowserMessageWriter(self)));