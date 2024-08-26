import { makeGraphqlRequest } from './graphql';

const ONCHAIN_COORDINAPE_ADDRESS = '0x7e823AE179592525301ceb33b3eC479f8c66ecB9';
const GRAPHQL_ENDPOINT = 'https://base.easscan.org/graphql';

export type CoordinapeAttestation = {
  from: string;
  amount: number;
  platform: string;
  url: string;
  context: string;
  skill: string;
  tag: string;
  note: string;
  weight: number;
};

type RawAttestationData = {
  attestations: {
    id: string;
    attester: string;
    recipient: string;
    revoked: boolean;
    timeCreated: number;
    decodedDataJson: string;
  }[];
};

const getValueFromData = (data: any[], name: string): any =>
  data.find((d: any) => d.name === name)?.value?.value;

const parseRawDataIntoAttestation = (rawData: string): CoordinapeAttestation => {
  const data = JSON.parse(rawData);
  return {
    from: getValueFromData(data, 'from'),
    amount: getValueFromData(data, 'amount'),
    platform: getValueFromData(data, 'platform'),
    url: getValueFromData(data, 'url'),
    context: getValueFromData(data, 'context'),
    skill: getValueFromData(data, 'skill'),
    tag: getValueFromData(data, 'tag'),
    note: getValueFromData(data, 'note'),
    weight: getValueFromData(data, 'weight'),
  };
};

const getAttestationsQuery = `
  query GetAttestations($addresses: [String!]) {
    attestations(where: {
      attester: { equals: "${ONCHAIN_COORDINAPE_ADDRESS}" },
      recipient: { in: $addresses, mode: insensitive },
      revoked: { equals: false }
    }) {
      id
      attester
      recipient
      revoked
      timeCreated
      decodedDataJson
      }
    }
 `;

const fetchAttestations = async (addresses: string[]): Promise<RawAttestationData> => {
  const variables = { addresses };
  return makeGraphqlRequest<RawAttestationData>(
    GRAPHQL_ENDPOINT,
    getAttestationsQuery,
    variables
  );
};

export async function getCoordinapeInfoForAddresses(addressesString: string): Promise<CoordinapeAttestation[]> {
  if (!addressesString || !addressesString.length) {
    return [];
  }

  const addresses = addressesString.split(',');

  try {
    const response = await fetchAttestations(addresses);

    if (!response?.attestations?.length) {
      return [];
    }

    const attestations = response.attestations.map(attestation =>
      parseRawDataIntoAttestation(attestation.decodedDataJson)
    );

    const filteredAttestations = attestations.filter(attestation => attestation.skill);

    const groupedAttestations = filteredAttestations.reduce((acc, attestation) => {
      const existing = acc.find(a => a.skill === attestation.skill);
      if (existing) {
        existing.amount += attestation.amount * attestation.weight;
      } else {
        acc.push(attestation);
      }
      return acc;
    }, [] as CoordinapeAttestation[]);
    return groupedAttestations.sort((a, b) => b.amount - a.amount);
  } catch (error) {
    console.error('Error fetching Coordinape attestations:', error);
    return [];
  }
}
