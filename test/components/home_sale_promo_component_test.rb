require "test_helper"

class HomeSalePromoComponentTest < ViewComponent::TestCase
  Sale = Struct.new(:live?, :title, :top_percentage)

  test "links to the sale page while a sale is live" do
    render_inline HomeSalePromoComponent.new(sale: Sale.new(true, "Hardware Day", 50))

    assert_selector "a.home-sale-promo[href='/shop/category/sale']", text: "Hardware Day · up to 50% off"
  end

  test "stays hidden between sales" do
    render_inline HomeSalePromoComponent.new(sale: Sale.new(false, "Hardware Day", 50))

    assert_no_selector ".home-sale-promo"
  end
end
