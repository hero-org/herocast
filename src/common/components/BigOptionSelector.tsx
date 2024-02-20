import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type OptionSelectorType = {
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
};

type BigOptionSelectorProps = {
  options: OptionSelectorType[];
};

const BigOptionSelector = ({ options }: BigOptionSelectorProps) => {
  const renderOption = (option: OptionSelectorType) => {
    return (
      <Card key={option.title} className="max-w-sm col-span-1">
        <CardHeader>
          <CardTitle>{option.title}</CardTitle>
          <CardDescription>{option.description}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" onClick={() => option.onClick()}>
            {option.buttonText}
        </Button>
        </CardFooter>
      </Card>
    );
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {options.map((option) => renderOption(option))}
    </div>
  );
};

export default BigOptionSelector;
