import React, { useEffect, useState } from "react";
import { classNames } from "@/common/helpers/css";
import { makeGraphqlRequest } from "@/common/helpers/graphql";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import get from "lodash.get";
import isEmpty from "lodash.isempty";
import { openWindow } from "../../helpers/navigation";

const NOUNS_BUILDER_GRAPHQL_ENDPOINT = {
  'mainnet': 'https://api.thegraph.com/subgraphs/name/neokry/nouns-builder-mainnet',
  'ethereum': 'https://api.thegraph.com/subgraphs/name/neokry/nouns-builder-mainnet',
  // 'zora': 'https://api.goldsky.com/api/public/project_clkk1ucdyf6ak38svcatie9tf/subgraphs/nouns-builder-zora-mainnet',
  'optimism': 'https://api.thegraph.com/subgraphs/name/neokry/noun-builder-optimism-mainnet',
};

const query = `
  query a($tokenAddress: String!, $proposalNumber: Int, $proposalId: String) {
    dao(id: $tokenAddress) {
      id
      name
      proposals(
        where: {or: [{proposalNumber: $proposalNumber}, {proposalId: $proposalId}]}
      ) {
        proposalId
        proposalNumber
        title,
        voteStart,
        voteEnd,
        quorumVotes,
        voteCount,
        againstVotes,
        forVotes,
        queued,
        executed,
        canceled,
      }
    }
  }
`;

// url format can be
// https://nouns.build/dao/0xa45662638e9f3bbb7a6fecb4b17853b7ba0f3a60/vote/0x8c31080de5d8a88d2856100db6a707283dcd3bd951219219771a6f837a3b8697
// https://nouns.build/dao/ethereum/0xdf9b7d26c8fc806b1ae6273684556761ff02d422/vote/73
// https://nouns.build/dao/zora/0x32297b7416294b1acf404b6148a3c58107ba8afd/44
//
//
const NounsBuildEmbed = ({ url }: { url: string }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const getData = async () => {
      let chain = 'mainnet';
      let tokenAddress = '', proposalNumber = '', proposalId = '';
      const firstParam = url.split('https://nouns.build/dao/')[1].split('/')[0];
      if (firstParam.startsWith('0x')) {
        tokenAddress = firstParam;
      } else {
        tokenAddress = url.split('https://nouns.build/dao/')[1].split('/')[1];
        chain = firstParam;
      }
      const proposalStr = url.split('vote/')[1];
      if (proposalStr.startsWith('0x')) {
        proposalNumber = null;
        proposalId = proposalStr;
      } else {
        proposalNumber = parseInt(proposalStr);
        proposalId = null;
      }
      const variables = {
        tokenAddress,
        proposalNumber,
        proposalId
      };

      const endpoint = get(NOUNS_BUILDER_GRAPHQL_ENDPOINT, chain);
      if (!endpoint) {
        console.error('NounsBuildEmbed: no endpoint for chain', chain);
        return;
      }
      setData(await makeGraphqlRequest(
        endpoint,
        query,
        variables
      ));
    };

    getData();
  }, []);

  const renderContent = () => {
    if (!data || !data.dao || isEmpty(data.dao.proposals)) {
      return null;
    }

    const proposal = data.dao.proposals[0];
    const getProposalStatus = () => {
      if (proposal.voteEnd * 1000 < Date.now()) {
        if (proposal.executed) {
          return 'Executed';
        } else if (proposal.queued) {
          return 'Queued';
        } else if (proposal.canceled) {
          return 'Canceled';
        }
        return 'Done';
      }
      if (proposal.voteStart * 1000 > Date.now()) {
        return 'Not started';
      }
      return 'In progress';
    };
    const stats = [
      { name: 'Status', value: getProposalStatus() },
      { name: 'Voted for', value: proposal.forVotes, unit: 'votes' },
      { name: 'Voted against', value: proposal.againstVotes, unit: 'votes' },
      { name: 'Vote threshold', value: proposal.quorumVotes, unit: 'votes' },
      { name: 'Date ending', value: new Date(Number(proposal.voteEnd) * 1000).toLocaleDateString() },
      { name: 'Date staring', value: new Date(Number(proposal.voteStart) * 1000).toLocaleDateString() },
    ]

    return (<div className="max-w-2xl">
      <div className="flex flex-col items-start justify-between gap-x-8 gap-y-4 bg-gray-700/10 px-4 py-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div>
          <div className="flex items-center gap-x-3">
            <div className="flex-none rounded-full bg-green-400/10 p-1 text-green-400">
              <div className="h-2 w-2 rounded-full bg-current" />
            </div>
            <h1 className="flex gap-x-3 text-base leading-7 ">
              <span className="font-semibold text-white">{data.dao.name}</span>
              <span className="text-gray-600">/</span>
              <span className="font-semibold text-white flex-nowrap">{proposal.title}</span>
            </h1>
          </div>
          <p className="mt-2 text-xs leading-6 text-gray-400">Proposal {proposal.proposalNumber}</p>
        </div>
        {/* <div className="order-first flex-none rounded-full bg-indigo-400/10 px-2 py-1 text-xs font-medium text-indigo-400 ring-1 ring-inset ring-indigo-400/30 sm:order-none">
          Proposal {proposal.proposalNumber}
        </div> */}
        <button
          type="button"
          onClick={() => openWindow(url)}
          className="inline-flex items-center rounded-sm bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
        >
          Details
          <ArrowTopRightOnSquareIcon className="mt-0.5 w-4 h-4 ml-1.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 bg-gray-700/10 sm:grid-cols-2 lg:grid-cols-2">
        {stats.map((stat, statIdx) => (
          <div
            key={stat.name}
            className={classNames(
              statIdx % 2 === 1 ? 'sm:border-l' : statIdx === 2 ? 'lg:border-l' : '',
              'border-t border-white/5 py-6 px-4 sm:px-6 lg:px-8'
            )}
          >
            <p className="text-sm font-medium leading-6 text-gray-400">{stat.name}</p>
            <p className="mt-2 flex items-baseline gap-x-2">
              <span className="text-4xl font-semibold tracking-tight text-white">{stat.value}</span>
              {stat.unit ? <span className="text-sm text-gray-400">{stat.unit}</span> : null}
            </p>
          </div>
        ))}
      </div>
    </div>)
  }

  return <div className="text-white" key={`nouns-build-embed-${url}`}>
    {/* NOUNS URL {url}<br />{JSON.stringify(data)} */}
    {!isEmpty(data) && renderContent()}
  </div>;
}

export default NounsBuildEmbed;
