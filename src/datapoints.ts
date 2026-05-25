import { Datapoint, type Connection } from 'knx';

export interface KnxDatapointOptions {
  groupAddress: string;
  dpt: string;
  autoread?: boolean;
}

export function createDatapoint(connection: Connection, options: KnxDatapointOptions): Datapoint {
  return new Datapoint({
    ga: options.groupAddress,
    dpt: options.dpt,
    autoread: options.autoread,
  }, connection);
}
