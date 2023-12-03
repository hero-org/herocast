import React, { useEffect, useState } from "react";
import { classNames } from "@/common/helpers/css";
import { makeGraphqlRequest } from "@/common/helpers/graphql";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import get from "lodash.get";
import isEmpty from "lodash.isempty";
import { openWindow } from "../../helpers/navigation";

type StatsType = {
  name: string;
  value: string | number;
  unit?: string;
};

const NOUNS_BUILDER_GRAPHQL_ENDPOINT = {
  mainnet:
    "https://api.thegraph.com/subgraphs/name/neokry/nouns-builder-mainnet",
  ethereum:
    "https://api.thegraph.com/subgraphs/name/neokry/nouns-builder-mainnet",
  zora: "https://api.goldsky.com/api/public/project_clkk1ucdyf6ak38svcatie9tf/subgraphs/nouns-builder-zora-mainnet/stable/gn",
  optimism:
    "https://api.thegraph.com/subgraphs/name/neokry/noun-builder-optimism-mainnet",
};

const query = `
  query a($tokenAddress: String!, $proposalNumber: Int, $proposalId: String, $tokenId: Int) {
    dao(id: $tokenAddress) {
      id
      name
      tokens (where: { tokenId: $tokenId }) {
        id,
        name,
        tokenId,
        mintedAt,
        image
      }
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

const NounsBuildEmbed = ({ url }: { url: string }) => {
  const [data, setData] = useState<{
    dao: { name: string; proposals: any[]; tokens: any[] };
  } | null>(null);

  useEffect(() => {
    const getData = async () => {
      let chain = "mainnet";
      let tokenAddress = "",
        proposalNumber: number | null = null,
        proposalId = "",
        tokenId: number | null = null;
      const firstParam = url.split("https://nouns.build/dao/")[1].split("/")[0];
      if (firstParam.startsWith("0x")) {
        tokenAddress = firstParam;
      } else {
        tokenAddress = url.split("https://nouns.build/dao/")[1].split("/")[1];
        chain = firstParam;
      }

      const proposalStr = url.split("vote/")[1];
      if (proposalStr) {
        if (proposalStr.startsWith("0x")) {
          proposalId = proposalStr;
        } else {
          proposalNumber = parseInt(proposalStr);
        }
      } else {
        const urlParts = url.split("/");
        tokenId = parseInt(urlParts[urlParts.length - 1]);
      }

      const variables = {
        tokenAddress,
        proposalNumber,
        proposalId,
        tokenId,
      };

      const endpoint = get(NOUNS_BUILDER_GRAPHQL_ENDPOINT, chain);
      if (!endpoint) {
        console.error("NounsBuildEmbed: no endpoint for chain", chain);
        return;
      }

      setData(await makeGraphqlRequest(endpoint, query, variables));
    };
    try {
      getData();
    } catch (e) {
      console.log("NounsBuildEmbed: ", url, "error", e);
    }
  }, []);

  const getProposalStatus = (proposal) => {
    if (proposal.voteEnd * 1000 < Date.now()) {
      if (proposal.executed) {
        return "Executed";
      } else if (proposal.queued) {
        return "Queued";
      } else if (proposal.canceled) {
        return "Canceled";
      }
      return "Done";
    }
    if (proposal.voteStart * 1000 > Date.now()) {
      return "Not started";
    }
    return "In progress";
  };

  const getProposalStats = (proposal) => {
    return [
      { name: "Status", value: getProposalStatus(proposal) },
      { name: "Voted for", value: proposal.forVotes, unit: "votes" },
      { name: "Voted against", value: proposal.againstVotes, unit: "votes" },
      { name: "Vote threshold", value: proposal.quorumVotes, unit: "votes" },
      {
        name: "Date ending",
        value: new Date(Number(proposal.voteEnd) * 1000).toLocaleString(),
      },
      {
        name: "Date starting",
        value: new Date(Number(proposal.voteStart) * 1000).toLocaleString(),
      },
    ];
  };

  const renderContent = () => {
    if (
      !data ||
      !data.dao ||
      (isEmpty(data.dao.proposals) && isEmpty(data.dao.tokens))
    ) {
      return null;
    }
    const proposal = data.dao.proposals[0];
    const token = data.dao.tokens[0];

    let stats: StatsType[] = [];
    if (proposal) {
      stats = getProposalStats(proposal);
    } else if (token) {
      stats = [
        {
          name: "Minted at",
          value: new Date(Number(token.mintedAt) * 1000).toLocaleDateString(),
        },
      ];
    }

    return (
      <div className="max-w-2xl">
        <div className="flex flex-col items-start justify-between gap-x-8 gap-y-4 bg-gray-700/10 px-4 py-4 sm:flex-row sm:items-center sm:px-6 lg:px-4">
          <div>
            <div className="mt-2 flex items-center gap-x-3 ">
              {/* <div className="flex-none rounded-full bg-green-400/10 p-1 text-green-400">
              <div className="h-2 w-2 rounded-full bg-current" />
            </div> */}
              <h1 className="flex gap-x-1 text-base leading-7 ">
                <span className="font-semibold text-white">
                  {data.dao.name}
                </span>
                <span className="text-gray-600">/</span>
                <span className="font-semibold text-white flex-nowrap">
                  {proposal?.title || token?.name}
                </span>
              </h1>
            </div>
            <div className="flex flex-row justify-between">
              {proposal?.proposalNumber && (
                <p className="text-xs leading-6 text-gray-400">
                  Proposal {proposal.proposalNumber}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openWindow(url)}
            className="mt-2 inline-flex items-center rounded-sm bg-gray-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
          >
            Details
            <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-1" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 bg-gray-700/10 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat, statIdx) => (
            <div
              key={stat.name}
              className={classNames(
                statIdx % 2 === 1
                  ? "sm:border-l"
                  : statIdx === 2
                  ? "lg:border-l"
                  : "",
                "border-t border-white/5 py-6 px-4 sm:px-3 lg:px-4"
              )}
            >
              <p className="text-sm font-medium leading-6 text-gray-400">
                {stat.name}
              </p>
              <p className="mt-1 flex items-baseline gap-x-2">
                <span className="text-2xl font-semibold tracking-tight text-white">
                  {stat.value}
                </span>
              </p>
              {stat.unit ? (
                <span className="text-sm text-gray-100">{stat.unit}</span>
              ) : null}
            </div>
          ))}
          {token?.image && (
            <div className="border-t border-white/5 py-6 px-4 sm:px-6 lg:px-8">
              <p className="text-sm font-medium leading-6 text-gray-400">
                Image
              </p>
              <div className="mt-2 flex items-center gap-x-2">
                <img src={token.image} className="w-16 h-16 rounded-lg" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="max-w-fit text-white rounded-lg border border-gray-500"
      key={`nouns-build-embed-${url}`}
    >
      {!isEmpty(data) && renderContent()}
    </div>
  );
};

export default NounsBuildEmbed;
