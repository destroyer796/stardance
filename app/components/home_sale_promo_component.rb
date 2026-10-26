# frozen_string_literal: true

# Slim strip at the top of the home page linking to the shop's clearance sale
# while one is live.
class HomeSalePromoComponent < ViewComponent::Base
  attr_reader :sale

  def initialize(sale:)
    @sale = sale
  end

  def render?
    sale.live?
  end
end
